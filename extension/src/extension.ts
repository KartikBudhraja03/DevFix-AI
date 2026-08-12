import * as vscode from 'vscode';
import { execFile } from 'child_process';

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

            execFile(
                'python',
                ['-m', 'py_compile', filePath],
                (error, stdout, stderr) => {

                    // Remove old diagnostics
                    diagnostics.delete(editor.document.uri);

                    if (error) {

                        console.error(stderr);

                        const message = stderr.trim();

                        // Try to extract line number from Python error
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

                    } else {

                        diagnostics.delete(
                            editor.document.uri
                        );

                        vscode.window.showInformationMessage(
                            '✅ DevFix AI: No syntax errors found!'
                        );
                    }
                }
            );
        }
    );

    context.subscriptions.push(disposable);
}

export function deactivate() {}