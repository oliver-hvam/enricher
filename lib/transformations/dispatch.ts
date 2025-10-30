import { TransformationConfig } from "@/lib/types/transformation";

import { runCustomTransformation } from "./custom";
import { runLlmTransformation } from "./llm";
import { runN8nTransformation } from "./n8n";
import { TransformationDependencyRow, TransformationExecutor } from "./types";
import { runWebScrapeTransformation } from "./web-scrape";

export function getTransformationExecutor(
  config: TransformationConfig
): TransformationExecutor {
  return (dependencyRows: TransformationDependencyRow[]) => {
    switch (config.type) {
      case "llm":
        return runLlmTransformation({ rows: dependencyRows, config });
      case "n8n":
        return runN8nTransformation({ rows: dependencyRows, config });
      case "web_scrape":
        return runWebScrapeTransformation({ rows: dependencyRows, config });
      case "custom":
        return runCustomTransformation({ rows: dependencyRows, config });
      default: {
        const exhaustiveCheck: never = config;
        throw new Error(`Unsupported transformation type: ${exhaustiveCheck}`);
      }
    }
  };
}
