;;; org-agenda-runner.el --- Headless Org-mode agenda and task parser -*- lexical-binding: t; -*-

(require 'org)
(require 'org-element)
(require 'json)

(defun emacs-jail--parse-agenda-args (args)
  "Parse command line arguments for agenda runner."
  (let (files)
    (while args
      (let ((arg (pop args)))
        (cond
         ((string-equal arg "--files")
          (setq files (split-string (pop args) "," t "[ \t\n]+"))))))
    files))

(defun emacs-jail--extract-headline-data (headline file)
  "Extract structured metadata from an Org HEADLINE element in FILE."
  (let* ((title (org-element-property :raw-value headline))
         (level (org-element-property :level headline))
         (todo-type (org-element-property :todo-keyword headline))
         (priority (org-element-property :priority headline))
         (tags (org-element-property :tags headline))
         (scheduled (org-element-property :scheduled headline))
         (deadline (org-element-property :deadline headline)))
    (list :title (or title "")
          :level (or level 1)
          :todo (or todo-type "")
          :priority (if priority (char-to-string priority) "")
          :tags (vconcat (or tags '()))
          :scheduled (if scheduled (org-element-interpret-data scheduled) "")
          :deadline (if deadline (org-element-interpret-data deadline) "")
          :file file)))

(defun emacs-jail--collect-org-files ()
  "Find org files in the current directory and subdirectories."
  (directory-files-recursively default-directory "\\.org$"))

(defun emacs-jail-run-agenda ()
  "Extract all headlines and tasks as JSON."
  (let* ((arg-files (emacs-jail--parse-agenda-args argv))
         (target-files (or arg-files (emacs-jail--collect-org-files)))
         (results '()))
    (dolist (file target-files)
      (let ((actual-file (if (file-exists-p file)
                             file
                           (let ((alt (expand-file-name file "workspace")))
                             (if (file-exists-p alt) alt nil)))))
        (when actual-file
          (with-temp-buffer
            (insert-file-contents actual-file)
            (org-mode)
            (let ((ast (org-element-parse-buffer 'headline)))
              (org-element-map ast 'headline
                (lambda (hl)
                  (push (emacs-jail--extract-headline-data hl (file-relative-name actual-file default-directory))
                        results))))))))
    (setq results (nreverse results))
    (message "AGENDA_JSON: %s" (json-serialize (vconcat results)))
    (kill-emacs 0)))

(emacs-jail-run-agenda)
