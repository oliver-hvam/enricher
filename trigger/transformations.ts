// tasks/transformations.ts
import { task, logger } from "@trigger.dev/sdk/v3";
import pLimit from "p-limit";
import {
  applyTransformationUpdates,
  getTransformationById,
  getTransformationDependencyColumns,
  getTransformationDependencyRows,
} from "@/lib/data-access/transformations";
import { getRowIds, getColumnById } from "@/lib/data-access/lists";
import { TransformationConfig } from "@/lib/types/transformation";
import { getTransformationExecutor } from "@/lib/transformations";

// -------------------------
// Tunable knobs (edit freely)
// -------------------------
const ROWS_PER_WORKER = 500;
const MAX_PARALLEL_WORKERS = 6;

// -------------------------
// Public entrypoint (fan-out)
// -------------------------
export const applyTransformation = task({
  id: "apply-transformation", // orchestrator
  maxDuration: 60 * 15, // 15 min
  run: async (
    payload: {
      transformationId: string;
      /** optionally only process these rows */
      rowIds?: string[];
      /** re-run rows that already have values */
      force?: boolean;
    },
    { ctx }
  ) => {
    const { transformationId, rowIds, force } = payload;
    logger.log("Apply transformation (orchestrator) start", payload);

    // 1) Load transformation, its column, dataset, and dependencies
    const transformation = await getTransformationById(transformationId);
    if (!transformation)
      throw new Error(`Transformation ${transformationId} not found`);

    const targetColumn = await getColumnById(transformation.columnId);
    if (!targetColumn)
      throw new Error(`Target column ${transformation.columnId} not found`);

    const dependencyColumns = await getTransformationDependencyColumns(
      transformationId
    );
    const dependencyNames = dependencyColumns.map((d) => d.name);

    // 2) Find the row IDs to process
    logger.log("Finding rows to process.", payload);

    const idsToProcess = rowIds ?? (await getRowIds(targetColumn, force));

    if (idsToProcess.length === 0) {
      logger.log("Nothing to process");
      return { status: "nothing_to_do" as const };
    }

    // 3) Chunk row IDs and fan out to workers
    logger.log("Dispatching workers", {
      totalRows: idsToProcess.length,
    });

    const chunks: string[][] = [];
    for (let i = 0; i < idsToProcess.length; i += ROWS_PER_WORKER) {
      console.log("Creating chunk", { start: i });
      chunks.push(idsToProcess.slice(i, i + ROWS_PER_WORKER));
    }

    const limitWorkers = pLimit(MAX_PARALLEL_WORKERS);
    const results = await Promise.all(
      chunks.map((chunk, idx) =>
        limitWorkers(() =>
          applyTransformationChunk.trigger({
            targetColumnName: targetColumn.name,
            dependencyNames,
            rowIds: chunk,
            config: transformation.config,
            workerIndex: idx,
          })
        )
      )
    );

    logger.log("Orchestrator done", { workers: results.length });
    return { status: "queued", workers: results.length };
  },
});

// -------------------------
// Worker (per-chunk)
// -------------------------
export const applyTransformationChunk = task({
  id: "apply-transformation-chunk", // worker
  maxDuration: 60 * 10, // 10 min per chunk
  run: async (
    payload: {
      targetColumnName: string;
      dependencyNames: string[];
      rowIds: string[];
      config: TransformationConfig;
      workerIndex: number;
    },
    { ctx }
  ) => {
    const { targetColumnName, dependencyNames, rowIds, config, workerIndex } =
      payload;

    logger.log("Worker start", { workerIndex, count: rowIds.length });

    // 1) Hydrate inputs for just the rows & dependency columns we need
    //    We’ll select id plus each dependency as a scalar via ->>
    const dependencyRows = await getTransformationDependencyRows({
      rowIds,
      dependencyNames,
    });

    // 2) Dispatch by type
    logger.log("Running transformation executor");
    const executor = getTransformationExecutor(config);
    const updates = await executor(dependencyRows);

    // 3) Apply updates
    logger.log("Applying updates", { workerIndex, updates: updates.length });
    console.log("Applying updates", { workerIndex, updates: updates.length });
    await applyTransformationUpdates({ updates, targetColumnName });

    logger.log("Worker done", { workerIndex, updated: updates.length });
    return { updated: updates.length };
  },
});
