# 이미지 제작 기록

내장 `image_gen` 도구를 사용했습니다. CLI/API fallback은 사용하지 않았습니다.
프로젝트에 포함한 최종 원본은 이 폴더의 `assets/` 아래에 보관했습니다.

## broadcast-sunset.png

Use case: illustration-story. Asset type: visual novel background, landscape 16:9 1536x864. Create a polished hand-painted anime background for an original Korean short visual novel called 'Before the Last Broadcast'. Empty old school radio broadcasting room at late afternoon just before sunset. On left a large window casts amber light over wood floor; foreground at left a small mixing desk, vintage microphone on stand and cassette recorder with one unlit red indicator. Two simple chairs, shelves of tapes, a small wall clock near 5:00, a partly packed cardboard box. View from the doorway, eye level; keep center-right floor and wall uncluttered for a character portrait and bottom quarter quiet for dialogue UI. Warm dusty peach, lavender shadows, gentle melancholic hope, detailed cozy 2D painted scenery, clean perspective. No people, no words, no logos, no watermarks, no in-image UI.

## seoyun-neutral.png

Use case: illustration-story. Asset type: transparent character sprite for an original visual novel. One original Korean woman aged 22 named Seo-yun, returning to her old school to pack the broadcasting club room. Gentle anime visual-novel illustration with clean hand drawn linework and soft painted shading, natural restrained proportions. Shoulder-length dark chestnut hair, a small lavender barrette on her left side, warm brown eyes, ivory knitted cardigan over a pale blue blouse, navy pleated knee-length skirt. Standing three-quarter view facing slightly toward viewer's left, hands loosely holding a blank index card at waist, quietly uncertain expression, small closed mouth. Frame from top of head to just below knees, complete silhouette with generous transparent margin on all sides, no cropping, character centered, portrait 1024x1536. Subtle warm sunset rim light on left, readable against a warm radio room background. Genuine transparent alpha background, no environment, no ground shadow, no text, no logos, no extra characters, no border. This is a reusable sprite, no dialog UI.

## seoyun-smile.png

편집 대상: `seoyun-neutral.png`. 투명 배경 유지.

Use case: identity-preserve. Edit target: provided original character sprite. Create a second expression variant for the same visual novel. Change ONLY her facial expression into a gentle, relieved closed-mouth smile, eyes slightly softened, as though she has finally said thank you. Preserve EXACT character identity, face shape, hair, lavender clip, outfit, card, pose, proportions, framing, dimensions and lighting. Preserve existing alpha transparency; remove any opaque background or broad atmospheric glow so all pixels outside the clean character silhouette are truly alpha-transparent. No backdrop, no text, no new props, no cropping.

## broadcast-dusk.png

편집 대상: `broadcast-sunset.png`.

Use case: lighting-weather. Edit target: provided empty school broadcasting room background. Change ONLY time of day and ambient lighting to blue-hour dusk just after sunset. Preserve exactly all room geometry, camera position, furniture, tape shelves, equipment, microphone, clock, doorway and object placement. Through the window the sky is muted lavender-blue with a thin peach band on the horizon, no sun. Cool soft violet shadows and a little warm reflected light, readable details, tranquil hopeful mood, same painterly anime style. No people, no text, no UI, no extra objects. Same 16:9 composition.
