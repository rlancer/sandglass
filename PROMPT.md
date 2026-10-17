# Sandglass Sprite Benchmark — Master Prompt

Use this file as the **single source of truth** when generating character sprites for model comparison.

Goal: produce a consistent *Prince of Persia* (1989)–style side-view hero and guard that can be dropped into the Sandglass game. Judge models on **identity consistency**, **pose clarity**, **rotoscope-like weight**, and **clean cutout backgrounds**.

---

## Shared art direction

- Side view, character facing **RIGHT**
- Full body in frame, feet near bottom, headroom above
- Classic cinematic-platformer sprite: readable silhouette, natural human weight (rotoscope-like), flat cel shading, crisp dark outline
- **Not** photoreal skin pores, **not** 3D render, **not** chibi
- Background: solid pure magenta `#FF00FF` (for chroma key) — no floor, no drop shadow, no text, no watermark
- Keep scale and costume identical across every pose for the same character

---

## Character: Prince

<!-- PRINCE -->
Same hero character every time: athletic young Persian adventurer, tan skin, short black wavy hair, thin brown headband, sleeveless white vest over chest, saffron-orange sash at waist, baggy cream pantaloons, soft boots. Side view facing RIGHT. Art direction: classic Prince of Persia 1989 game sprite — rotoscope-like natural posing, readable silhouette, flat cel colors, crisp outline, no photoreal skin pores. Solid pure magenta #FF00FF background, no floor, no drop shadow, no text, no watermark.
<!-- /PRINCE -->

---

## Character: Guard

<!-- GUARD -->
Same guard character every time: stocky palace soldier, tan skin, silver rounded helmet, short red tunic, dark belt, tan trousers, brown sandals, holding a straight sword. Side view facing RIGHT. Art direction: classic Prince of Persia 1989 game sprite — rotoscope-like posing, flat cel colors, crisp outline. Solid pure magenta #FF00FF background, no floor, no drop shadow, no text.
<!-- /GUARD -->

---

## Pose list

Each pose is generated as its own image. The generator appends the pose line to the character block above.

| file | pose instruction |
|------|------------------|
| `prince_run_0.png` | run cycle contact — RIGHT foot planted, LEFT leg extended back, opposite arm forward, torso leaning slightly forward |
| `prince_run_1.png` | run cycle mid — RIGHT leg passing under body, LEFT knee driving forward, arms swinging |
| `prince_run_2.png` | run cycle flight — LEFT foot forward almost landing, RIGHT leg trailing, body airborne slightly |
| `prince_run_3.png` | run cycle contact — LEFT foot planted, RIGHT leg extended back, opposite arm forward |
| `prince_run_4.png` | run cycle mid — LEFT leg passing under body, RIGHT knee driving forward |
| `prince_run_5.png` | run cycle flight — RIGHT foot forward almost landing, LEFT leg trailing, airborne |
| `prince_idle.png` | relaxed idle standing, weight on one leg, arms loose at sides, calm breathing stance |
| `prince_walk.png` | careful slow walk mid-step, smaller stride than a run, cautious |
| `prince_crouch.png` | deep crouch, knees bent, hands near knees, ready |
| `prince_jump.png` | jumping upward, both knees tucked, arms reaching up |
| `prince_leap.png` | long forward leap mid-air, legs split front/back, arms forward for balance |
| `prince_fall.png` | falling downward, legs slightly apart, arms out for balance, concerned expression |
| `prince_land.png` | landing impact, knees deeply bent, hands forward low, absorbing fall |
| `prince_hang.png` | hanging from an invisible ledge by both hands above head, body dangling, legs slightly bent |
| `prince_climb.png` | climbing up over a ledge, one knee on the ledge, pulling torso up with arms |
| `prince_fight.png` | swordfighting en garde, holding a slim sword forward in RIGHT hand, left hand back, wide stance |
| `prince_strike.png` | sword strike fully extended — lunging forward, slim sword thrusting to the RIGHT, rear leg stretched |
| `prince_hurt.png` | stumbling recoil backward, one arm raised, off-balance |
| `prince_die.png` | collapsed resting on side on the ground, limp, asleep-looking, sword on ground nearby |
| `prince_pickup.png` | bending down picking up a slim sword from the ground with right hand |
| `guard_idle.png` | idle ready stance, sword held low |
| `guard_walk.png` | walking forward mid-stride with sword |
| `guard_fight.png` | en garde fight stance, sword raised toward opponent on the right |
| `guard_strike.png` | powerful sword strike lunging to the RIGHT |
| `guard_hurt.png` | hurt recoil from a hit |
| `guard_die.png` | fallen dead on the ground |

---

## Scoring rubric (for human / blind compare)

Score each model pack 1–5 on:

1. **Identity lock** — same face/costume across poses  
2. **Pose accuracy** — matches the pose instruction  
3. **Motion weight** — believable balance / rotoscope feel  
4. **Cutout quality** — clean edges, usable chroma key  
5. **Game fit** — readable at ~78px in-game height  

Write notes in `benchmark/runs/<run-id>/SCORE.md` after review.
