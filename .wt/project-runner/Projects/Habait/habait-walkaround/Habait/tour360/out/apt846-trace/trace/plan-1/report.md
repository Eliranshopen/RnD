# auto-trace report

rooms: 10 · fixtures: 21 · scale: 2.2677 px/cm

| # | room | printed cm | traced cm | delta % | m² |
|---|---|---|---|---|---|
| 1 | חדר שינה | 342×275 | 343×277 | 0.3/0.7 | 9.33 |
| 2 | חדר רחצה כללי | 199×140 | 199×141 | 0.0/0.7 | 2.78 |
| 3 | מטבח | — | 356×261 | — | 7.03 |
| 4 | פינת אוכל | — | 784×433 | — | 10.59 |
| 5 | חדר דיור | 744×530 | 746×560 | 0.3/5.7 | 35.57 |
| 6 | מרפסת שמש | — | 657×268 | — | 10.77 |
| 7 | חדר שינה הורים | 348×344 | 346×342 | -0.6/-0.6 | 11.83 |
| 8 | פינת ארונות | 185×160 | 184×159 | -0.5/-0.6 | 2.92 |
| 9 | חדר רחצה הורים | 212×210 | 211×208 | -0.5/-1.0 | 4.39 |
| 10 | מעבר | — | 768×355 | — | 8.45 |

## could not read / check

- room 'מבואה' (r-hall-auto-92): no closed region was traced around its label (the flood leaked or the label sits on a line)
- room 'מטבח' (r-kitchen): no printed dimensions were read; its size comes from the drawing only
- room 'פינת אוכל' (r-dining-area): no printed dimensions were read; its size comes from the drawing only
- room 'חדר דיור' (r-living-room): traced [746, 560] cm vs printed [530, 744] cm ([0.3, 5.7] %) — check the trace or the reading
- room 'מרפסת שמש' (r-sun-terrace): no printed dimensions were read; its size comes from the drawing only
- room 'מעבר' (r-corridor-141): no printed dimensions were read; its size comes from the drawing only