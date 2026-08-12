import ast
import sys
import json


class BugDetector(ast.NodeVisitor):

    def __init__(self):
        self.diagnostics = []

    def add_diagnostic(self, node, message, severity="warning"):
        self.diagnostics.append({
            "line": node.lineno,
            "message": message,
            "severity": severity
        })

    def check_unreachable(self, statements):

        terminated = False

        for statement in statements:

            if terminated:
                self.add_diagnostic(
                    statement,
                    "Unreachable code detected. This statement will never execute."
                )

            if isinstance(
                statement,
                (ast.Return, ast.Raise, ast.Break, ast.Continue)
            ):
                terminated = True

    def visit_FunctionDef(self, node):

        self.check_unreachable(node.body)

        self.generic_visit(node)

    def visit_AsyncFunctionDef(self, node):

        self.check_unreachable(node.body)

        self.generic_visit(node)

    def visit_If(self, node):

        self.check_unreachable(node.body)
        self.check_unreachable(node.orelse)

        self.generic_visit(node)

    def visit_For(self, node):

        self.check_unreachable(node.body)
        self.check_unreachable(node.orelse)

        self.generic_visit(node)

    def visit_While(self, node):

        self.check_unreachable(node.body)
        self.check_unreachable(node.orelse)

        self.generic_visit(node)


def analyze_file(file_path):

    try:

        with open(
            file_path,
            "r",
            encoding="utf-8"
        ) as file:

            source = file.read()

        tree = ast.parse(source)

        detector = BugDetector()
        detector.visit(tree)

        return detector.diagnostics

    except SyntaxError as error:

        return [{
            "line": error.lineno or 1,
            "message": f"SyntaxError: {error.msg}",
            "severity": "error"
        }]

    except Exception as error:

        return [{
            "line": 1,
            "message": f"Analyzer error: {str(error)}",
            "severity": "error"
        }]


if __name__ == "__main__":

    file_path = sys.argv[1]

    results = analyze_file(file_path)

    print(json.dumps(results))