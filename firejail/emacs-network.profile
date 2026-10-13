# Firejail profile for Emacs Org-Mode with controlled network access
# Used when package downloading or remote synchronization is explicitly needed.

private-tmp
private-dev
private-etc ca-certificates,crypto-policies,fonts,group,hosts,ld.so.cache,ld.so.conf,ld.so.conf.d,localtime,nsswitch.conf,passwd,pki,resolv.conf,ssl,emacs
private-bin emacs,python3,bash,sh,cat,ls,grep,sed,awk,find,which,curl,git,ssh

caps.drop all
ipc-namespace
nonewprivs
noroot
nosound
notv
novideo
seccomp
restrict-namespaces
disable-mnt

protocol unix,inet,inet6

rlimit-cpu 120
rlimit-as 1073741824
rlimit-nproc 128
rlimit-fsize 104857600
