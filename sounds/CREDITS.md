# Créditos dos efeitos sonoros

Todos os arquivos desta pasta são derivados de obras em **CC0 1.0 (domínio público)**
(https://creativecommons.org/publicdomain/zero/1.0/). A licença foi conferida na página
de cada asset em 26/11/2026. Não é necessário dar crédito, mas listamos os autores
como agradecimento.

## Processamento aplicado a todos os arquivos

Feito com ffmpeg 6.1 (ffmpeg-static):

1. Recorte do trecho útil (início e duração indicados abaixo).
2. Downmix para mono, reamostragem para 44,1 kHz.
3. Remoção de silêncio no início e no fim (detecção por pico).
4. Fade-in de 3 ms e fade-out no final (50 a 700 ms, conforme o som).
5. Normalização de loudness para pico momentâneo de cerca de -16 LUFS (tiros: -14 LUFS),
   com limitador em -1,7 dBFS. Tiros, flechas e estalos elétricos ficaram limitados pelo
   pico, então medem um pouco abaixo disso.
6. Codificação em Ogg Vorbis, qualidade 4.

"Recorte X–Y s" se refere a tempos no arquivo original.

## Armas de fogo

Fonte: **The Free Firearm Sound Library**, de Ben Jaszczak, Brian Nelson, Kevin Heras e
Matthew Nanney. Gravações reais, CC0.
https://opengameart.org/content/the-free-firearm-sound-library (arquivo `Prepared SFX Library.7z`)

| Arquivo | Original | Arma | Tratamento |
|---|---|---|---|
| tiro-pistola-1.ogg | `1911/A_42P.wav` | Colt 1911 .45, distância próxima | primeiro disparo, recorte a partir de 0,85 s, fade de 200 ms |
| tiro-pistola-2.ogg | `Walther PPQ/X_39P.wav` | Walther PPQ 9mm, próxima | primeiro disparo, a partir de 1,35 s |
| tiro-pistola-3.ogg | `Smith & Wesson 642/V_27P.wav` | revólver S&W 642 .38, próxima | primeiro disparo, a partir de 0,75 s |
| tiro-fuzil-1.ogg | `AR-15/D_32P.wav` | AR-15 5.56, próxima | primeiro disparo, a partir de 0,65 s, fade de 250 ms |
| tiro-fuzil-2.ogg | `AK-47/C_28P.wav` | AK-47 7.62x39, próxima | primeiro disparo, a partir de 0,55 s |
| tiro-fuzil-3.ogg | `Tikka/W_29P.wav` | Tikka T3 .30-06 (ferrolho), próxima | primeiro disparo, a partir de 0,45 s |
| tiro-espingarda-1.ogg | `Model 12/K_22P.wav` | Winchester Model 12, calibre 12 | primeiro disparo, a partir de 0,75 s |
| tiro-espingarda-2.ogg | `Nova/O_21P.wav` | Benelli Nova, calibre 12 | primeiro disparo, a partir de 0,35 s |
| tiro-espingarda-3.ogg | `CD/H_21P.wav` | Charles Daly (pump), calibre 12 | primeiro disparo, a partir de 0,35 s |

## Arco, besta, golpes e erros

**Medieval Sound Effects: Weapon Textures**, de Ben Jaszczak e Brian Nelson (Still North Media),
gravações reais, CC0: https://opengameart.org/content/medieval-sound-effects-weapon-textures
(arquivos `medieval_sfx_textures_1_of_2.7z` / `_2_of_2.7z`)

| Arquivo | Original | Tratamento |
|---|---|---|
| flecha-1.ogg | `Scythian Recurve Shoot.wav` | primeiro disparo (recorte 0,15–0,75 s) |
| flecha-2.ogg | `English Longbow Shoot.wav` | disparo em 1,12–1,72 s |
| flecha-3.ogg | `Crossbow Shoot.wav` | primeiro disparo (0,25–0,85 s) |
| errou-1.ogg | `Crossbow Bolt Passby.wav` | primeira passagem do virote (0,15–0,75 s) |
| errou-2.ogg | `Crossbow Bolt Passby.wav` | terceira passagem (1,65–2,40 s) |
| golpe-3.ogg | `Axe Swing.wav` | um golpe de machado (1,45–2,05 s) |

**Swish – bamboo stick weapon swhoshes**, de qubodup (Iwan Gabovitch), gravação real
(vara de bambu diante do microfone), CC0:
https://opengameart.org/content/swish-bamboo-stick-weapon-swhoshes (arquivo `swoshes.7z`)

| Arquivo | Original | Tratamento |
|---|---|---|
| errou-3.ogg | `swosh-16.flac` | arquivo inteiro |
| golpe-1.ogg | `swosh-03.flac` | arquivo inteiro |
| golpe-2.ogg | `swosh-13.flac` | arquivo inteiro |

## Acertos corpo a corpo e dano

| Arquivo | Fonte (CC0) | Original | Tratamento |
|---|---|---|---|
| golpe-acerto-1.ogg | "Punch", qubodup: https://opengameart.org/content/punch (`qubodupPunch.7z`) | `qubodupPunch01.flac` | inteiro |
| golpe-acerto-2.ogg | idem | `qubodupPunch04.flac` | inteiro |
| golpe-acerto-3.ogg | "Impact Sounds", Kenney: https://kenney.nl/assets/impact-sounds | `impactPunch_heavy_000.ogg` | inteiro |
| impacto-1.ogg | "Impact", qubodup: https://opengameart.org/content/impact (`qubodupImpact.7z`) | `qubodupImpactMeat02.flac` | inteiro |
| impacto-2.ogg | "Impact Sounds", Kenney: https://kenney.nl/assets/impact-sounds | `impactSoft_heavy_001.ogg` | inteiro |
| impacto-3.ogg | "40 wet towel club/pound/hit/attack sounds", qubodup: https://opengameart.org/content/40-wet-towel-clubpoundhitattack-sounds (`wet_towel_on_body.7z`) | `wet_towel_on_body-02.flac` | inteiro |

## Cura, poder, coração, loucura

| Arquivo | Fonte (CC0) | Original | Tratamento |
|---|---|---|---|
| cura-1.ogg | "Healing Spell Impacts", lentikula: https://lentikula.itch.io/healing-spell-impacts | `Healing Spell Impact 3.wav` | recorte de 0–2,5 s, fade de 150 ms |
| cura-2.ogg | idem | `Healing Spell Impact 11.wav` | recorte de 0–2,5 s, fade de 200 ms |
| cura-3.ogg | idem | `Healing Spell Impact 6.wav` | recorte de 0–2,5 s, fade de 200 ms |
| poder-1.ogg | "Theremin Sci-Fi Sparkles", Zane Little Music: https://opengameart.org/content/theremin-sci-fi-sparkles | `Sparkles/Sparkle 40.wav` | inteiro (até 2 s) |
| poder-2.ogg | idem | `Sparkles/Sparkle 21.wav` | inteiro |
| poder-3.ogg | idem | `Big Sparkles/Big Sparkle 16.wav` | inteiro |
| coracao-1.ogg | "Heartbeat (single sound)", Independent.nu (enviado por qubodup): https://opengameart.org/content/heartbeat-single-sound | `heartbeat.mp3_.flac` | uma batida (0–1,7 s), fade de 300 ms |
| coracao-2.ogg | idem | `heartbeat.mp3_.flac` | batida duplicada com 0,85 s de intervalo (mixada consigo mesma) |
| coracao-3.ogg | idem | `heartbeat.mp3_.flac` | tocada a 0,8x (mais lenta e grave), duplicada com 1,05 s de intervalo |
| loucura-1.ogg | "Ghostly Humming", Nocturnal_Vanguard (AuraVoice): https://opengameart.org/content/ghostly-humming | `ghostly_humming.ogg` | recorte de 0,3–4,3 s, fade de 700 ms |
| loucura-2.ogg | "Ghost breath", qubodup: https://opengameart.org/content/ghost-breath | `ghostbreath.flac` | respiração no sentido normal (0–3,3 s), fade de 600 ms, -18 LUFS |
| loucura-3.ogg | "4 Atmospheric ghostly loops", Independent.nu (enviado por qubodup): https://opengameart.org/content/4-atmospheric-ghostly-loops | `atmoseerie02.mp3.flac` | recorte de 2–6 s, fade-in de 400 ms, fade-out de 700 ms |
| san-zero-1.ogg | "Heartbeat (single sound)", Independent.nu + "Horror Hit Soundpack 1", psychhead_: https://opengameart.org/content/horror-hit-soundpack-1 | `heartbeat.mp3_.flac`, `Pitches/Very Bassy/Very Bassy 1.wav` | duas batidas (a segunda mais fraca e lenta), impacto em 1,5 s, zumbido agudo de 3,9 kHz e grave crescente de 55/82 Hz gerados no ffmpeg |
| san-zero-2.ogg | idem | `heartbeat.mp3_.flac`, `Pitches/Very Bassy/Very Bassy 4.wav` | uma batida, impacto em 1,1 s, zumbido de 4,4 kHz e grave crescente gerados no ffmpeg |

## Rituais: Energia

| Arquivo | Fonte (CC0) | Original | Tratamento |
|---|---|---|---|
| energia-conjurar-1.ogg | "Electricity Game Sound Pack", faxcorp: https://opengameart.org/node/150369 | `snaploop.wav` | recorte de 0,15–1,75 s (estalos elétricos) |
| energia-conjurar-2.ogg | idem | `crackleelectricityloop.wav` | loop de 0,5 s repetido 3x (1,5 s) |
| energia-conjurar-3.ogg | "Electricity Sound Effects", BMacZero (Brian MacIntosh), gravado de um gerador Tesla: https://opengameart.org/content/electricity-sound-effects-0 | `continuousspark.wav` | faísca contínua repetida 5x (cerca de 1,1 s) |
| energia-acerto-1.ogg | "Basic Spell Impacts", lentikula: https://lentikula.itch.io/freecc0-basic-spell-impacts-sfx | `Lightning Spell Impact 4.wav` | recorte de 0,05–2,55 s, fade de 400 ms |
| energia-acerto-2.ogg | idem | `Lightning Spell Impact 2.wav` | recorte de 0,6–3,1 s, fade de 400 ms |
| energia-acerto-3.ogg | "Electricity Game Sound Pack", faxcorp: https://opengameart.org/node/150369 | `death.wav` (servido como `death_1.wav`) | recorte de 0–1,8 s |

## Rituais: Sangue

| Arquivo | Fonte (CC0) | Original | Tratamento |
|---|---|---|---|
| sangue-conjurar-1.ogg | "8 wet squish, slurp impacts", Independent.nu (enviado por qubodup): https://opengameart.org/content/8-wet-squish-slurp-impacts | `impactsplat05.mp3.flac` | inteiro |
| sangue-conjurar-2.ogg | "Sci-fi Sounds", Kenney: https://kenney.nl/assets/sci-fi-sounds | `slime_001.ogg` | recorte de 0,75–2,05 s |
| sangue-conjurar-3.ogg | "Heartbeat (single sound)", Independent.nu: https://opengameart.org/content/heartbeat-single-sound | `heartbeat.mp3_.flac` | tocada a 0,62x com passa-baixa em 900 Hz (pulso grave) |
| sangue-acerto-1.ogg | "Fleshy Bone Break/Snap SFX", Zane Little Music: https://opengameart.org/content/fleshy-bone-breaksnap-sfx | `Wet Break 1.wav` | inteiro |
| sangue-acerto-2.ogg | idem | `Wet Break 4.wav` | inteiro |
| sangue-acerto-3.ogg | "8 wet squish, slurp impacts", Independent.nu | `impactsplat01.mp3.flac` | inteiro |

## Rituais: Morte

| Arquivo | Fonte (CC0) | Original | Tratamento |
|---|---|---|---|
| morte-conjurar-1.ogg | "3 dark magic spells", qubodup: https://opengameart.org/content/3-dark-magic-spells | `fout-01.flac` | recorte de 0–2,6 s, fade de 300 ms |
| morte-conjurar-2.ogg | "Energy Drain", qubodup: https://opengameart.org/content/energy-drain | `qubodup-PowerDrain.flac` | recorte de 0–2,4 s |
| morte-conjurar-3.ogg | "Ticking clock.", bart: https://opengameart.org/content/ticking-clock | `ticking_clock.wav` | três tiques (0,95–3,25 s) |
| morte-acerto-1.ogg | "Wind, hit, time morph", qubodup: https://opengameart.org/content/wind-hit-time-morph | `qubodup-slomo1.wav` | inteiro |
| morte-acerto-2.ogg | "3 dark magic spells", qubodup | `fout-02.flac` | inteiro |
| morte-acerto-3.ogg | idem | `fout-03.flac` | recorte de 0–2,5 s, fade de 400 ms |

## Rituais: Conhecimento

| Arquivo | Fonte (CC0) | Original | Tratamento |
|---|---|---|---|
| conhecimento-conjurar-1.ogg | "Theremin Sci-Fi Sparkles", Zane Little Music | `Big Sparkles/Big Sparkle 1.wav` | recorte de 0–2,2 s |
| conhecimento-conjurar-2.ogg | idem | `Big Sparkles/Big Sparkle 12.wav` | recorte de 0–2,4 s |
| conhecimento-conjurar-3.ogg | "Magic Spell SFX", JaggedStone: https://opengameart.org/content/magic-spell-sfx | `magical_3.ogg` | inteiro |
| conhecimento-acerto-1.ogg | "Bell dings/chimes", PWL: https://opengameart.org/content/bell-dingschimes | `bell_ding3.wav` | inteiro |
| conhecimento-acerto-2.ogg | idem | `bell_ding2.wav` | inteiro |
| conhecimento-acerto-3.ogg | "Magic Spell SFX", JaggedStone | `magical_1.ogg` | inteiro |

## Rituais: Medo

| Arquivo | Fonte (CC0) | Original | Tratamento |
|---|---|---|---|
| medo-conjurar-1.ogg | "Ghost breath", qubodup: https://opengameart.org/content/ghost-breath | `ghostbreath.flac` | invertido (crescendo reverso), sem os 0,6 s iniciais |
| medo-conjurar-2.ogg | "Horror Hit Soundpack 1", psychhead_: https://opengameart.org/content/horror-hit-soundpack-1 | `Pitches/Mid/Mid 9.wav` | invertido (crescendo reverso), últimos cerca de 3 s |
| medo-acerto-1.ogg | idem | `Pitches/Bassy/Bassy 4.wav` | recorte de 0–2,6 s, fade de 500 ms |
| medo-acerto-2.ogg | idem | `Pitches/High/High 9.wav` | recorte de 0–2,6 s, fade de 500 ms |
