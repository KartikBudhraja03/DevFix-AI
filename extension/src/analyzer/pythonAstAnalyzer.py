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

    # -----------------------------------------
    # 1. UNREACHABLE CODE
    # -----------------------------------------

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

        self.check_duplicate_conditions(node)

        self.generic_visit(node)

    def visit_For(self, node):

        self.check_unreachable(node.body)
        self.check_unreachable(node.orelse)

        self.generic_visit(node)

    def visit_While(self, node):

        self.check_unreachable(node.body)
        self.check_unreachable(node.orelse)

        self.check_infinite_loop(node)

        self.generic_visit(node)

    # -----------------------------------------
    # 2. DUPLICATE CONDITIONS
    # -----------------------------------------

    def check_duplicate_conditions(self, node):

        conditions = set()

        current = node

        while isinstance(current, ast.If):

            condition = ast.dump(
                current.test,
                include_attributes=False
            )

            if condition in conditions:

                self.add_diagnostic(
                    current.test,
                    "Duplicate condition detected. This condition was already checked."
                )

            conditions.add(condition)

            # Check elif chain
            if (
                len(current.orelse) == 1
                and isinstance(current.orelse[0], ast.If)
            ):
                current = current.orelse[0]

            else:
                break

    # -----------------------------------------
    # 3. POSSIBLE DIVISION BY ZERO
    # -----------------------------------------

    def visit_BinOp(self, node):

        if isinstance(
            node.op,
            (ast.Div, ast.FloorDiv, ast.Mod)
        ):

            if (
                isinstance(node.right, ast.Constant)
                and node.right.value == 0
            ):

                self.add_diagnostic(
                    node,
                    "Possible division by zero detected. The denominator is 0.",
                    "error"
                )

        self.generic_visit(node)

    # -----------------------------------------
    # 4. INFINITE LOOP
    # -----------------------------------------

    def check_infinite_loop(self, node):

        is_always_true = (
            isinstance(node.test, ast.Constant)
            and node.test.value is True
        )

        if not is_always_true:
            return

        if not self.contains_break(node.body):

            self.add_diagnostic(
                node,
                "Potential infinite loop detected. The loop condition is always true and no break was found."
            )

    def contains_break(self, statements):

        for statement in statements:

            for child in ast.walk(statement):

                if isinstance(child, ast.Break):
                    return True

                # Don't inspect nested functions/classes.
                if isinstance(
                    child,
                    (
                        ast.FunctionDef,
                        ast.AsyncFunctionDef,
                        ast.ClassDef
                    )
                ):
                    continue

        return False


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

    if len(sys.argv) < 2:

        print(json.dumps([
            {
                "line": 1,
                "message": "No Python file was provided.",
                "severity": "error"
            }
        ]))

        sys.exit(1)

    file_path = sys.argv[1]

    results = analyze_file(file_path)

    print(json.dumps(results))