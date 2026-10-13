#!/usr/bin/env python3
"""Literate programming and Babel workflow example."""

from emacs_jail.archive import UserArchiveManager
from emacs_jail.emacs import EmacsOrgManager


def main():
    emacs = EmacsOrgManager()
    mgr = UserArchiveManager()
    uid = "literate_dev"

    doc = """#+TITLE: Literate Calculator Module
#+AUTHOR: Non-system User literate_dev

* Specification
This module defines a safe mathematical evaluator.

* Implementation
Here is the core function tangled directly into =calc.py=:

#+begin_src python :tangle calc.py
def square(n):
    \"\"\"Return square of n.\"\"\"
    return n * n

def factorial(n):
    \"\"\"Return factorial of n.\"\"\"
    if n <= 1:
        return 1
    return n * factorial(n - 1)

if __name__ == "__main__":
    print(f"5! = {factorial(5)}")
#+end_src

* In-document Verification
Let's verify the calculation directly inside Emacs Org-Babel:

#+begin_src python :results output
from calc import factorial, square
print(f"Square of 12: {square(12)}")
print(f"Factorial of 6: {factorial(6)}")
#+end_src
"""
    print(f"1. Writing literate document to {uid}'s workspace...")
    mgr.write_file(uid, "workspace/calc.org", doc)

    print("2. Tangling source code blocks into calc.py...")
    tangle_res = emacs.babel_tangle(uid, "calc.org")
    print(f"   Tangled files: {tangle_res.tangled_files}")

    print("3. Executing in-document verification code blocks inside Firejail sandbox...")
    exec_res = emacs.babel_execute(uid, "calc.org")
    print("   Updated document results section:")
    for line in exec_res.content.splitlines():
        if "#+RESULTS:" in line or "Square of 12:" in line or "Factorial of 6:" in line:
            print(f"   {line}")

    print("\n4. Tangled calc.py content in user's zip archive:")
    calc_py = mgr.read_file(uid, "workspace/calc.py").decode("utf-8")
    print(calc_py)


if __name__ == "__main__":
    main()
