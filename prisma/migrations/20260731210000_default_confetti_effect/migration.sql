-- Confete passa a ser o efeito de vitória padrão de todo streamer.
-- Streamers criados antes disso ficaram em "none" (sem efeito) e o sorteio
-- terminava sem nenhuma comemoração na tela. Quem escolheu outro efeito de
-- propósito (fireworks/sparkles) mantém a escolha — só "none" é convertido.
UPDATE "Streamer" SET "eventEffect" = 'confetti' WHERE "eventEffect" = 'none';
