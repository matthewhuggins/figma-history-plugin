type HistoryEntryType = "page" | "selection";

type HistoryEntry = {
  id: string;
  type: HistoryEntryType;
  timestamp: number;
  fileKey: string;
  pageId: string;
  pageName: string;
  nodeId?: string;
  nodeName?: string;
  nodeType?: string;
  viewport?: {
    center: Vector;
    zoom: number;
  };
};

type UiToPluginMessage =
  | { type: "request-history" }
  | { type: "jump-to-entry"; id: string }
  | { type: "clear-history" }
  | { type: "close-plugin" };

const MAX_HISTORY = 100;
const DEDUPE_WINDOW_MS = 1200;
const SELECTION_DEBOUNCE_MS = 250;

const fileKey = figma.fileKey ?? "unsaved-file";
const storageKey = `history::${fileKey}`;

let historyEntries: HistoryEntry[] = [];
let selectionDebounceTimer: number | undefined;
let saveInFlight = false;
let saveQueued = false;

function makeEntryId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function readSelectionNode(): SceneNode | null {
  const selected = figma.currentPage.selection[0];
  return selected ?? null;
}

function snapshotViewport(): HistoryEntry["viewport"] {
  return {
    center: { ...figma.viewport.center },
    zoom: figma.viewport.zoom
  };
}

function buildEntry(type: HistoryEntryType): HistoryEntry {
  const page = figma.currentPage;
  const selectedNode = type === "selection" ? readSelectionNode() : null;
  return {
    id: makeEntryId(),
    type,
    timestamp: Date.now(),
    fileKey,
    pageId: page.id,
    pageName: page.name,
    nodeId: selectedNode?.id,
    nodeName: selectedNode?.name,
    nodeType: selectedNode?.type,
    viewport: snapshotViewport()
  };
}

function targetKey(entry: HistoryEntry): string {
  return `${entry.pageId}::${entry.nodeId ?? "page"}`;
}

function shouldSkipAsNoise(entry: HistoryEntry): boolean {
  const previous = historyEntries[0];
  if (!previous) {
    return false;
  }
  const sameTarget = targetKey(previous) === targetKey(entry);
  const nearInTime = entry.timestamp - previous.timestamp < DEDUPE_WINDOW_MS;
  return sameTarget && nearInTime;
}

function applyCapAndDedupe(entry: HistoryEntry): boolean {
  if (shouldSkipAsNoise(entry)) {
    return false;
  }

  const incomingKey = targetKey(entry);
  historyEntries = historyEntries.filter((existing) => targetKey(existing) !== incomingKey);
  historyEntries.unshift(entry);

  if (historyEntries.length > MAX_HISTORY) {
    historyEntries = historyEntries.slice(0, MAX_HISTORY);
  }

  return true;
}

async function persistHistory(): Promise<void> {
  if (saveInFlight) {
    saveQueued = true;
    return;
  }

  saveInFlight = true;
  try {
    await figma.clientStorage.setAsync(storageKey, historyEntries);
  } finally {
    saveInFlight = false;
    if (saveQueued) {
      saveQueued = false;
      await persistHistory();
    }
  }
}

async function loadHistory(): Promise<void> {
  const stored = await figma.clientStorage.getAsync(storageKey);
  if (!Array.isArray(stored)) {
    historyEntries = [];
    return;
  }

  historyEntries = stored
    .filter((entry): entry is Record<string, unknown> => !!entry && typeof entry === "object")
    .map((entry): HistoryEntry => {
      const entryType: HistoryEntryType = entry.type === "selection" ? "selection" : "page";
      const viewportValue =
        entry.viewport &&
        typeof entry.viewport === "object" &&
        "zoom" in entry.viewport &&
        "center" in entry.viewport
          ? (entry.viewport as { zoom?: unknown; center?: unknown })
          : undefined;

      const centerValue =
        viewportValue &&
        viewportValue.center &&
        typeof viewportValue.center === "object" &&
        "x" in viewportValue.center &&
        "y" in viewportValue.center
          ? (viewportValue.center as { x?: unknown; y?: unknown })
          : undefined;

      return {
        id: typeof entry.id === "string" ? entry.id : makeEntryId(),
        type: entryType,
        timestamp: typeof entry.timestamp === "number" ? entry.timestamp : Date.now(),
        fileKey: typeof entry.fileKey === "string" ? entry.fileKey : fileKey,
        pageId: typeof entry.pageId === "string" ? entry.pageId : "",
        pageName: typeof entry.pageName === "string" ? entry.pageName : "Unknown page",
        nodeId: typeof entry.nodeId === "string" ? entry.nodeId : undefined,
        nodeName: typeof entry.nodeName === "string" ? entry.nodeName : undefined,
        nodeType: typeof entry.nodeType === "string" ? entry.nodeType : undefined,
        viewport:
          viewportValue &&
          typeof viewportValue.zoom === "number" &&
          centerValue &&
          typeof centerValue.x === "number" &&
          typeof centerValue.y === "number"
            ? {
                zoom: viewportValue.zoom,
                center: {
                  x: centerValue.x,
                  y: centerValue.y
                }
              }
            : undefined
      };
    })
    .filter((entry) => entry.pageId.length > 0)
    .slice(0, MAX_HISTORY);
}

function postHistoryToUi(): void {
  figma.ui.postMessage({
    type: "history-data",
    entries: historyEntries
  });
}

async function captureHistory(type: HistoryEntryType): Promise<void> {
  if (type === "selection" && figma.currentPage.selection.length === 0) {
    return;
  }

  const entry = buildEntry(type);
  const changed = applyCapAndDedupe(entry);
  if (!changed) {
    return;
  }

  postHistoryToUi();
  await persistHistory();
}

function queueSelectionCapture(): void {
  if (selectionDebounceTimer !== undefined) {
    clearTimeout(selectionDebounceTimer);
  }

  selectionDebounceTimer = setTimeout(() => {
    captureHistory("selection").catch((error) => {
      console.error("Failed to capture selection history:", error);
    });
  }, SELECTION_DEBOUNCE_MS) as unknown as number;
}

async function clearHistory(sendUiUpdate = true): Promise<void> {
  historyEntries = [];
  await figma.clientStorage.setAsync(storageKey, historyEntries);
  if (sendUiUpdate) {
    postHistoryToUi();
  }
}

function findPageById(pageId: string): PageNode | null {
  const node = figma.getNodeById(pageId);
  if (node && node.type === "PAGE") {
    return node;
  }
  return null;
}

async function findSceneNode(nodeId: string): Promise<SceneNode | null> {
  let node = await figma.getNodeByIdAsync(nodeId);
  if (!node) {
    node = figma.getNodeById(nodeId);
  }
  if (node && "type" in node && node.type !== "PAGE") {
    return node as SceneNode;
  }
  return null;
}

async function jumpToHistoryEntry(entryId: string): Promise<void> {
  const entry = historyEntries.find((candidate) => candidate.id === entryId);
  if (!entry) {
    figma.notify("History entry not found.");
    return;
  }

  const page = findPageById(entry.pageId);
  if (!page) {
    figma.notify(`Cannot find page "${entry.pageName}" anymore.`);
    return;
  }

  if (figma.currentPage.id !== page.id) {
    await figma.setCurrentPageAsync(page);
  }

  if (entry.nodeId) {
    const node = await findSceneNode(entry.nodeId);
    if (node) {
      figma.currentPage.selection = [node];
      figma.viewport.scrollAndZoomIntoView([node]);
      return;
    }
  }

  figma.currentPage.selection = [];
  figma.notify(`Moved to page "${entry.pageName}".`);
}

function showHistoryUi(): void {
  figma.showUI(__html__, {
    width: 360,
    height: 520,
    title: "History"
  });
}

function onUiMessage(message: UiToPluginMessage): void {
  if (message.type === "request-history") {
    postHistoryToUi();
    return;
  }

  if (message.type === "jump-to-entry") {
    jumpToHistoryEntry(message.id).catch((error) => {
      console.error("Jump failed:", error);
      figma.notify("Unable to jump to that history entry.");
    });
    return;
  }

  if (message.type === "clear-history") {
    clearHistory().catch((error) => {
      console.error("Clear history failed:", error);
      figma.notify("Unable to clear history.");
    });
    return;
  }

  if (message.type === "close-plugin") {
    figma.closePlugin();
  }
}

async function startPlugin(): Promise<void> {
  await loadHistory();

  if (figma.command === "clear-history") {
    await clearHistory(false);
    figma.notify("History cleared.");
    figma.closePlugin();
    return;
  }

  showHistoryUi();
  figma.ui.onmessage = onUiMessage;

  figma.on("currentpagechange", () => {
    captureHistory("page").catch((error) => {
      console.error("Failed to capture page history:", error);
    });
  });

  figma.on("selectionchange", () => {
    queueSelectionCapture();
  });

  figma.on("close", () => {
    if (selectionDebounceTimer !== undefined) {
      clearTimeout(selectionDebounceTimer);
    }
  });

  postHistoryToUi();
  await captureHistory(figma.currentPage.selection.length > 0 ? "selection" : "page");
}

startPlugin().catch((error) => {
  console.error("Plugin failed to start:", error);
  figma.notify("History plugin failed to start.");
  figma.closePlugin();
});
