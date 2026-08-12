import * as vscode from 'vscode';
import { analyzePythonFile } from './analyzer/pythonAnalyzer';
import { execFile } from 'child_process';
import * as path from 'path';

export function activate(context: vscode.ExtensionContext) {

    console.log('DevFix AI is now active!');

    const diagnostics =
        vscode.languages.createDiagnosticCollection('devfix-ai');

    context.subscriptions.push(diagnostics);

    const disposable = vscode.commands.registerCommand(
        'devfix-ai.analyzeCurrentFile',
        () => {

            const editor = vscode.window.activeTextEditor;

            if (!editor) {
                vscode.window.showWarningMessage(
                    'DevFix AI: Please open a file first.'
                );
                return;
            }

            const filePath = editor.document.fileName;

            if (!filePath.endsWith('.py')) {
                vscode.window.showInformationMessage(
                    'DevFix AI currently analyzes Python files.'
                );
                return;
            }

            vscode.window.showInformationMessage(
                'DevFix AI is analyzing your Python file...'
            );

            // First: Python syntax check
            execFile(
                'python',
                ['-m', 'py_compile', filePath],
                (error, stdout, stderr) => {

                    // Remove old diagnostics
                    diagnostics.delete(editor.document.uri);

                    // -------------------------------
                    // SYNTAX ERROR
                    // -------------------------------
                    if (error) {

                        console.error(stderr);

                        const message = stderr.trim();

                        const lineMatch =
                            message.match(/line (\d+)/);

                        const lineNumber =
                            lineMatch
                                ? parseInt(lineMatch[1], 10)
                                : 1;

                        const lineIndex =
                            Math.max(lineNumber - 1, 0);

                        const line =
                            editor.document.lineAt(lineIndex);

                        const diagnostic =
                            new vscode.Diagnostic(
                                new vscode.Range(
                                    lineIndex,
                                    0,
                                    lineIndex,
                                    line.text.length
                                ),
                                'DevFix AI: ' + message,
                                vscode.DiagnosticSeverity.Error
                            );

                        diagnostic.source = 'DevFix AI';

                        diagnostics.set(
                            editor.document.uri,
                            [diagnostic]
                        );

                        vscode.window.showErrorMessage(
                            '❌ DevFix AI found a Python syntax error.'
                        );

                        return;
                    }

                    // -------------------------------
                    // SYNTAX IS VALID
                    // NOW RUN AST ANALYZER
                    // -------------------------------

                    vscode.window.showInformationMessage(
                        '✅ Syntax valid. DevFix AI is checking for logical bugs...'
                    );

                    /*
                     * Extension Development Host opens the
                     * extension folder, but our .venv is one
                     * level above it.
                     *
                     * DevFix-AI/
                     * ├── .venv/
                     * └── extension/
                     */
                    const projectRoot =
                        path.resolve(context.extensionPath, '..');

                    analyzePythonFile(
                        filePath,
                        projectRoot
                    ).then((results) => {

                        const astDiagnostics: vscode.Diagnostic[] = [];

                        for (const result of results) {

                            const lineIndex =
                                Math.max(result.line - 1, 0);

                            if (
                                lineIndex >=
                                editor.document.lineCount
                            ) {
                                continue;
                            }

                            const line =
                                editor.document.lineAt(lineIndex);

                            let severity =
                                vscode.DiagnosticSeverity.Warning;

                            if (result.severity === 'error') {
                                severity =
                                    vscode.DiagnosticSeverity.Error;
                            }

                            if (result.severity === 'info') {
                                severity =
                                    vscode.DiagnosticSeverity.Information;
                            }

                            const diagnostic =
                                new vscode.Diagnostic(
                                    new vscode.Range(
                                        lineIndex,
                                        0,
                                        lineIndex,
                                        line.text.length
                                    ),
                                    'DevFix AI: ' + result.message,
                                    severity
                                );

                            diagnostic.source = 'DevFix AI';

                            astDiagnostics.push(diagnostic);
                        }

                        // Show AST results in Problems Panel
                        diagnostics.set(
                            editor.document.uri,
                            astDiagnostics
                        );

                        if (astDiagnostics.length === 0) {

                            vscode.window.showInformationMessage(
                                '✅ DevFix AI: No bugs detected!'
                            );

                        } else {

                            vscode.window.showWarningMessage(
                                `⚠️ DevFix AI found ${astDiagnostics.length} issue(s).`
                            );
                        }

                    }).catch((astError) => {

                        console.error(
                            'AST Analyzer failed:',
                            astError
                        );

                        vscode.window.showErrorMessage(
                            '❌ DevFix AI AST analysis failed.'
                        );
                    });
                }
            );
        }
    );

    context.subscriptions.push(disposable);
}

export function deactivate() {}