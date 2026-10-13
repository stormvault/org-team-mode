# Firejail strict profile for pure Emacs Lisp / Org-mode execution
# Disallows all external subprocesses and interpreters.

private-tmp
private-dev
private-etc fonts,group,ld.so.cache,ld.so.conf,ld.so.conf.d,localtime,passwd,emacs
private-bin emacs

caps.drop all
ipc-namespace
nonewprivs
noroot
nosound
notv
novideo
seccomp
restrict-namespaces
memory-deny-write-execute
disable-mnt
net none

# Conservative limits
rlimit-cpu 30
rlimit-as 536870912
rlimit-nproc 32
rlimit-fsize 52428800
