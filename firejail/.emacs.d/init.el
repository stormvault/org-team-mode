;;; init.el --- Emacs-Jail User Initialization -*- lexical-binding: t; -*-
(set-language-environment "UTF-8")
(prefer-coding-system 'utf-8)
(setq inhibit-startup-screen t
      make-backup-files nil
      auto-save-default nil
      create-lockfiles nil)
(require 'org)
(setq org-export-with-toc t
      org-export-with-section-numbers t)
