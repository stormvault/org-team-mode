;;; org-export-runner.el --- Headless Org-mode exporter for Emacs-Jail -*- lexical-binding: t; -*-

(require 'org)
(require 'ox)

;; Suppress user query prompts
(setq make-backup-files nil
      auto-save-default nil
      create-lockfiles nil
      org-export-with-broken-links 'mark
      org-html-htmlize-output-type nil) ; graceful fallback if htmlize not installed

(defun emacs-jail--parse-args (args)
  "Parse command line arguments passed after --."
  (let (input-file format output-file)
    (while args
      (let ((arg (pop args)))
        (cond
         ((string-equal arg "--input") (setq input-file (pop args)))
         ((string-equal arg "--format") (setq format (pop args)))
         ((string-equal arg "--output") (setq output-file (pop args))))))
    (list input-file format output-file)))

(defun emacs-jail-run-export ()
  "Run the org export based on command line arguments."
  (let* ((parsed (emacs-jail--parse-args argv))
         (input-file (nth 0 parsed))
         (fmt (downcase (or (nth 1 parsed) "html")))
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
          (let ((exported-file
                 (cond
                  ((string-equal fmt "html")
                   (require 'ox-html)
                   (org-html-export-to-html))
                  ((or (string-equal fmt "md") (string-equal fmt "markdown"))
                   (require 'ox-md)
                   (org-md-export-to-markdown))
                  ((or (string-equal fmt "txt") (string-equal fmt "ascii"))
                   (require 'ox-ascii)
                   (org-ascii-export-to-ascii))
                  ((or (string-equal fmt "latex") (string-equal fmt "tex"))
                   (require 'ox-latex)
                   (org-latex-export-to-latex))
                  ((string-equal fmt "org")
                   (require 'ox-org)
                   (org-org-export-to-org))
                  (t
                   (message "Error: Unsupported export format '%s'" fmt)
                   (kill-emacs 3)))))
            (when (and output-file (file-exists-p exported-file) (not (string-equal exported-file output-file)))
              (rename-file exported-file output-file t)
              (setq exported-file output-file))
            (message "EXPORT_SUCCESS: %s" exported-file)
            (kill-emacs 0))
        (error
         (message "EXPORT_ERROR: %s" (error-message-string err))
         (kill-emacs 4))))))

(emacs-jail-run-export)
