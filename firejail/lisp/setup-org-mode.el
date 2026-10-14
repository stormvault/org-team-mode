;;; setup-org-mode.el --- Setup and tangle NorAng org-mode.org -*- lexical-binding: t; -*-

;;; Commentary:
;; Convenience wrapper and loader for org-mode-setup.el.

(let ((dir (file-name-directory (or load-file-name buffer-file-name default-directory))))
  (load (expand-file-name "org-mode-setup.el" dir)))

(provide 'setup-org-mode)
;;; setup-org-mode.el ends here
