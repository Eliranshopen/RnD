# auto-trace report

rooms: 10 · fixtures: 20 · scale: 2.2677 px/cm

| # | room | printed cm | traced cm | delta % | m² |
|---|---|---|---|---|---|
| 1 | חדר שינה | 342×275 | 343×276 | 0.3/0.4 | 9.40 |
| 2 | חדר רחצה כללי | 199×140 | 199×141 | 0.0/0.7 | 2.78 |
| 3 | מטבח | — | 357×261 | — | 7.01 |
| 4 | פינת אוכל | — | 1403×556 | — | 39.25 |
| 5 | חדר דיור | 744×530 | 888×560 | 19.4/5.7 | 36.90 |
| 6 | חדר שינה הורים | 348×344 | 346×342 | -0.6/-0.6 | 11.83 |
| 7 | פינת ארונות | 185×160 | 184×159 | -0.5/-0.6 | 2.92 |
| 8 | חדר רחצה הורים | 212×210 | 211×208 | -0.5/-1.0 | 4.39 |
| 9 | מרפסת שמש | 474×270 | 771×332 | 62.7/23.0 | 15.53 |
| 10 | מעבר | — | 522×208 | — | 7.13 |

## could not read / check

- room 'מבואה' (r-hall-auto-91): no closed region was traced around its label (the flood leaked or the label sits on a line)
- room 'מטבח' (r-kitchen): no printed dimensions were read; its size comes from the drawing only
- room 'פינת אוכל' (r-dining-area): no printed dimensions were read; its size comes from the drawing only
- room 'חדר דיור' (r-living-room): traced [888, 560] cm vs printed [530, 744] cm ([19.4, 5.7] %) — check the trace or the reading
- room 'מרפסת שמש' (r-sun-balcony): traced [771, 332] cm vs printed [270, 474] cm ([62.7, 23.0] %) — check the trace or the reading
- room 'מעבר' (r-corridor-177): no printed dimensions were read; its size comes from the drawing only