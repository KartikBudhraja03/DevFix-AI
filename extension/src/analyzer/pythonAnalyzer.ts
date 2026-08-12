import * as vscode from "vscode";
import { execFile } from "child_process";
import * as path from "path";

export interface PythonDiagnostic {
    line: number;
    message: string;
    severity: "error" | "warning" | "info";
}

export function analyzePythonFile(
    filePath: string,
    workspacePath: string
): Promise<PythonDiagnostic[]> {

    return new Promise((resolve) => {

        const pythonPath = path.join(
            workspacePath,
            ".venv",
            "Scripts",
            "python.exe"
        );

        const analyzerPath = path.join(
            workspacePath,
            "extension",
            "src",
            "analyzer",
            "pythonAstAnalyzer.py"
        );

        execFile(
            pythonPath,
            [analyzerPath, filePath],
            (error, stdout, stderr) => {

                if (error) {
                    console.error("AST Analyzer Error:", stderr);
                    resolve([]);
                    return;
                }

                try {
                    const results: PythonDiagnostic[] =
                        JSON.parse(stdout);

                    resolve(results);
                } catch (parseError) {
                    console.error(
                        "Could not parse AST analyzer output:",
                        parseError
                    );

                    resolve([]);
                }
            }
        );
    });
}