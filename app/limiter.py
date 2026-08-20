from slowapi import Limiter
from slowapi.util import get_remote_address

# Limiter compartilhado por IP. Armazenamento em memória (padrão do slowapi)
# -- suficiente para um único processo; num deploy com múltiplos workers
# cada processo teria seu próprio contador, mas isso ainda é bem melhor do
# que não ter nenhum limite, que era o estado anterior.
limiter = Limiter(key_func=get_remote_address)
