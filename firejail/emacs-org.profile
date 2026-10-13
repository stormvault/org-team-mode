# Firejail profile for isolated Emacs and Org-Mode execution
# Specialized for multi-tenant, non-system user-ID sandboxed environments.

# Dedicated clean isolated /tmp directory (tmpfs)
private-tmp

# Restrict /dev to essential pseudo-devices (null, zero, urandom, tty, etc.)
private-dev

# Minimal /etc exposure
private-etc ca-certificates,crypto-policies,fonts,group,hosts,ld.so.cache,ld.so.conf,ld.so.conf.d,localtime,nsswitch.conf,passwd,resolv.conf,emacs

# Whitelist binaries allowed inside the sandbox (Emacs + org-babel runners)
private-bin emacs,python,python3,bash,sh,cat,ls,grep,sed,awk,find,which,head,tail,cut,sort,uniq,wc,tr,echo,date,make

# System hardening & attack surface reduction
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

# Zero-trust networking: isolate from LAN, localhost, and Internet
net none

# Default resource governance limits (RLIMITs)
# Prevent runaway processes, memory exhaustion, fork bombs, and quota denial of service
rlimit-cpu 60
rlimit-as 1073741824
rlimit-nproc 128
rlimit-fsize 104857600
