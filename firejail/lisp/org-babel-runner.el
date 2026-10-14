;;; org-babel-runner.el --- Headless Org-Babel runner for Emacs-Jail -*- lexical-binding: t; -*-

(require 'org)
(require 'ob)

;; Enable popular babel execution languages safely inside the sandbox
(condition-case nil (require 'ob-python) (error nil))
(condition-case nil (require 'ob-shell) (error nil))
(condition-case nil (require 'ob-emacs-lisp) (error nil))

(org-babel-do-load-languages
 'org-babel-load-languages
 '((emacs-lisp . t)
   (python . t)
   (shell . t)))

;; Explicitly configure python command
(setq org-babel-python-command (if (executable-find "python3") "python3" "python"))

;; In an isolated sandbox, allow evaluation without interactive prompt
(setq org-confirm-babel-evaluate nil
      make-backup-files nil
      auto-save-default nil
      create-lockfiles nil)

(defun emacs-jail--parse-babel-args (args)
  "Parse command line arguments for babel execution."
  (let (input-file (action "execute") output-file)
    (while args
      (let ((arg (pop args)))
        (cond
         ((string-equal arg "--input") (setq input-file (pop args)))
         ((string-equal arg "--action") (setq action (pop args)))
         ((string-equal arg "--output") (setq output-file (pop args))))))
    (list input-file action output-file)))

(defun emacs-jail-run-babel ()
  "Run org-babel execute or tangle."
  (let* ((parsed (emacs-jail--parse-babel-args argv))
         (input-file (nth 0 parsed))
         (action (downcase (or (nth 1 parsed) "execute")))
         (output-file (nth 2 parsed)))
    (unless input-file
      (message "Error: --input <file.org> is required")
      (kill-emacs 1))
    (unless (file-exists-p input-file)
      (let ((alt (expand-file-name input-file "workspace")))
        (if (file-exists-p alt)
            (setq input-file alt)
          (message "Error: File does not exist: %s" input-file)
          (kill-emacs 2))))

    (when (and output-file (not (file-name-directory output-file)))
      (setq output-file (expand-file-name output-file (or (file-name-directory input-file) "workspace/"))))

    (with-current-buffer (find-file-noselect input-file)
      (condition-case err
          (cond
           ((string-equal action "tangle")
            (let ((tangled-files (org-babel-tangle)))
              (message "BABEL_TANGLE_SUCCESS: %s" (mapconcat #'identity (or tangled-files '()) ", "))
              (kill-emacs 0)))
           ((string-equal action "execute")
            (org-babel-execute-buffer)
            (let ((dest (or output-file input-file)))
              (write-file dest)
              (message "BABEL_EXECUTE_SUCCESS: %s" dest)
              (kill-emacs 0)))
           (t
            (message "Error: Unknown babel action '%s'" action)
            (kill-emacs 3)))
        (error
         (message "BABEL_ERROR: %s" (error-message-string err))
         (kill-emacs 4))))))

(emacs-jail-run-babel)
