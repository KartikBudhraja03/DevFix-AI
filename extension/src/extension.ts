import * as vscode from 'vscode';
import { analyzePythonFile } from './analyzer/pythonAnalyzer';
import { execFile } from 'child_process';
import * as path from 'path';
import * as http from 'http';

interface AIResponse {
    response?: string;
}

function askOllama(prompt: string): Promise<string> {

    console.log('🚀 DevFix AI: Starting Ollama request...');

    return new Promise((resolve, reject) => {

        const requestBody = JSON.stringify({
            model: 'qwen3:8b',
            prompt: prompt,
            stream: false
        });

        console.log('📡 DevFix AI: Sending request to Ollama...');

        const request = http.request(
            {
                hostname: '127.0.0.1',
                port: 11434,
                path: '/api/generate',
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Content-Length': Buffer.byteLength(requestBody)
                }
            },
            (response) => {

                console.log(
                    `📥 Ollama response status: ${response.statusCode}`
                );

                let data = '';

                response.on('data', (chunk) => {
                    data += chunk;
                });

                response.on('end', () => {

                    console.log('📦 Ollama response received.');

                    try {

                        const result: AIResponse =
                            JSON.parse(data);

                        if (result.response) {
                            resolve(result.response);
                        } else {
                            reject(
                                new Error(
                                    'Ollama returned an empty response.'
                                )
                            );
                        }

                    } catch (error) {

                        console.error(
                            '❌ Failed to parse Ollama response:',
                            data
                        );

                        reject(
                            new Error(
                                'Could not parse Ollama response.'
                            )
                        );
                    }
                });
            }
        );

        request.on('error', (error) => {

            console.error(
                '❌ Ollama connection error:',
                error
            );

            reject(error);
        });

        request.setTimeout(120000, () => {

            console.error(
                '❌ Ollama request timed out.'
            );

            request.destroy(
                new Error(
                    'Ollama request timed out after 120 seconds.'
                )
            );
        });

        request.write(requestBody);
        request.end();
    });
}


export function activate(
    context: vscode.ExtensionContext
) {

    console.log(
        '🚀 DevFix AI extension activated!'
    );

    const diagnostics =
        vscode.languages.createDiagnosticCollection(
            'devfix-ai'
        );

    context.subscriptions.push(
        diagnostics
    );


    // -----------------------------------------
    // AI OUTPUT CHANNEL
    // -----------------------------------------

    const aiOutput =
        vscode.window.createOutputChannel(
            'DevFix AI'
        );

    context.subscriptions.push(
        aiOutput
    );


    // -----------------------------------------
    // ANALYZE CURRENT FILE COMMAND
    // -----------------------------------------

    const disposable =
        vscode.commands.registerCommand(
            'devfix-ai.analyzeCurrentFile',
            () => {

                console.log(
                    '🔍 DevFix AI: Analyze command started.'
                );

                const editor =
                    vscode.window.activeTextEditor;

                if (!editor) {

                    vscode.window.showWarningMessage(
                        'DevFix AI: Please open a file first.'
                    );

                    return;
                }


                const filePath =
                    editor.document.fileName;


                if (!filePath.endsWith('.py')) {

                    vscode.window.showInformationMessage(
                        'DevFix AI currently analyzes Python files.'
                    );

                    return;
                }


                vscode.window.showInformationMessage(
                    '🔎 DevFix AI is analyzing your Python file...'
                );


                // -----------------------------------------
                // STEP 1: PYTHON SYNTAX CHECK
                // -----------------------------------------

                execFile(
                    'python',
                    [
                        '-m',
                        'py_compile',
                        filePath
                    ],
                    async (
                        error,
                        stdout,
                        stderr
                    ) => {

                        diagnostics.delete(
                            editor.document.uri
                        );


                        // -----------------------------------------
                        // SYNTAX ERROR
                        // -----------------------------------------

                        if (error) {

                            console.error(
                                '❌ Python syntax error:',
                                stderr
                            );

                            const message =
                                stderr.trim();

                            const lineMatch =
                                message.match(
                                    /line (\d+)/
                                );

                            const lineNumber =
                                lineMatch
                                    ? parseInt(
                                        lineMatch[1],
                                        10
                                    )
                                    : 1;

                            const lineIndex =
                                Math.max(
                                    lineNumber - 1,
                                    0
                                );

                            const safeLineIndex =
                                Math.min(
                                    lineIndex,
                                    editor.document.lineCount - 1
                                );

                            const line =
                                editor.document.lineAt(
                                    safeLineIndex
                                );

                            const diagnostic =
                                new vscode.Diagnostic(
                                    new vscode.Range(
                                        safeLineIndex,
                                        0,
                                        safeLineIndex,
                                        line.text.length
                                    ),
                                    'DevFix AI: ' +
                                    message,
                                    vscode.DiagnosticSeverity.Error
                                );

                            diagnostic.source =
                                'DevFix AI';

                            diagnostics.set(
                                editor.document.uri,
                                [diagnostic]
                            );

                            vscode.window.showErrorMessage(
                                '❌ DevFix AI found a Python syntax error.'
                            );

                            return;
                        }


                        // -----------------------------------------
                        // STEP 2: SYNTAX VALID
                        // -----------------------------------------

                        console.log(
                            '✅ Python syntax is valid.'
                        );

                        vscode.window.showInformationMessage(
                            '✅ Syntax valid. DevFix AI is checking for logical bugs...'
                        );


                        const projectRoot =
                            path.resolve(
                                context.extensionPath,
                                '..'
                            );


                        // -----------------------------------------
                        // STEP 3: AST ANALYSIS
                        // -----------------------------------------

                        console.log(
                            '🐍 Running AST analyzer...'
                        );


                        try {

                            const results =
                                await analyzePythonFile(
                                    filePath,
                                    projectRoot
                                );


                            console.log(
                                '🐍 AST results:',
                                results
                            );


                            const astDiagnostics:
                                vscode.Diagnostic[] = [];


                            // -----------------------------------------
                            // AST DIAGNOSTICS
                            // -----------------------------------------

                            for (
                                const result of results
                            ) {

                                const lineIndex =
                                    Math.max(
                                        result.line - 1,
                                        0
                                    );


                                if (
                                    lineIndex >=
                                    editor.document.lineCount
                                ) {
                                    continue;
                                }


                                const line =
                                    editor.document.lineAt(
                                        lineIndex
                                    );


                                let severity =
                                    vscode.DiagnosticSeverity.Warning;


                                if (
                                    result.severity ===
                                    'error'
                                ) {

                                    severity =
                                        vscode.DiagnosticSeverity.Error;
                                }


                                if (
                                    result.severity ===
                                    'info'
                                ) {

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
                                        'DevFix AI: ' +
                                        result.message,
                                        severity
                                    );


                                diagnostic.source =
                                    'DevFix AI';


                                astDiagnostics.push(
                                    diagnostic
                                );
                            }


                            diagnostics.set(
                                editor.document.uri,
                                astDiagnostics
                            );


                            if (
                                results.length > 0
                            ) {

                                vscode.window.showWarningMessage(
                                    `⚠️ DevFix AI found ${results.length} issue(s).`
                                );

                            } else {

                                console.log(
                                    'ℹ️ AST found no known bugs. Sending code to AI for deeper analysis...'
                                );

                            }


                            // -----------------------------------------
                            // STEP 4: ALWAYS SEND CODE TO AI
                            // -----------------------------------------

                            const code =
                                editor.document.getText();


                            const bugDetails =
                                results.length > 0
                                    ? results
                                        .map(
                                            (result) =>
                                                `Line ${result.line}: ${result.message}`
                                        )
                                        .join('\n')
                                    : 'No bugs were detected by the AST analyzer.';


                            const prompt = `
You are DevFix AI, an expert Python debugging assistant.

Analyze the following Python code for programming bugs.

PYTHON CODE:
${code}

STATIC AST ANALYZER RESULT:
${bugDetails}

Your job is to find additional problems that a simple AST/static analyzer may miss.

Check especially for:

- Type errors
- Runtime errors
- Incorrect function arguments
- Incorrect use of variables
- String and number operations
- None values
- Division by zero
- Invalid assumptions
- Logic errors
- Common Python mistakes

For every problem you find:

BUG:
<short description>

EXPLANATION:
<simple beginner-friendly explanation>

SUGGESTED FIX:
<how to fix it>

CORRECTED CODE:
<corrected code if useful>

If the code is actually correct, clearly say:

NO ADDITIONAL BUGS FOUND

Do NOT reveal your internal thinking.
Do NOT output your chain of thought.
Keep the final answer concise and useful.
`;


                            // -----------------------------------------
                            // STEP 5: CALL OLLAMA
                            // -----------------------------------------

                            try {

                                vscode.window.showInformationMessage(
                                    '🤖 DevFix AI is asking Qwen3 for a deeper analysis...'
                                );


                                console.log(
                                    '🤖 Calling Ollama with code analysis prompt...'
                                );


                                const aiResult =
                                    await askOllama(
                                        prompt
                                    );


                                console.log(
                                    '✅ AI response received.'
                                );


                                // -----------------------------------------
                                // STEP 6: SHOW AI OUTPUT
                                // -----------------------------------------

                                aiOutput.clear();


                                aiOutput.appendLine(
                                    '========================================'
                                );


                                aiOutput.appendLine(
                                    '        🤖 DEVFIX AI ANALYSIS'
                                );


                                aiOutput.appendLine(
                                    '========================================'
                                );


                                aiOutput.appendLine('');


                                aiOutput.appendLine(
                                    aiResult.trim()
                                );


                                aiOutput.appendLine('');


                                aiOutput.appendLine(
                                    '========================================'
                                );


                                aiOutput.show(
                                    true
                                );


                                vscode.window.showInformationMessage(
                                    '🤖 DevFix AI analysis completed!'
                                );

                            } catch (
                                aiError
                            ) {

                                console.error(
                                    '❌ Ollama AI error:',
                                    aiError
                                );


                                vscode.window.showErrorMessage(
                                    '❌ Could not connect to Ollama. Make sure Ollama is running.'
                                );
                            }

                        } catch (
                            astError
                        ) {

                            console.error(
                                '❌ AST Analyzer failed:',
                                astError
                            );


                            vscode.window.showErrorMessage(
                                '❌ DevFix AI AST analysis failed.'
                            );
                        }
                    }
                );
            }
        );


    context.subscriptions.push(
        disposable
    );
}


export function deactivate() {}