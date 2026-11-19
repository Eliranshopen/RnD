# auto-trace report

rooms: 10 · fixtures: 10 · scale: 3.2741 px/cm (fitted ×0.9946 from the printed dims)

| # | room | printed cm | traced cm | delta % | m² |
|---|---|---|---|---|---|
| 1 | חדר דיור | — | 396×249 | — | 4.70 |
| 2 | מטבח | — | 532×420 | — | 7.98 |
| 3 | פינת אוכל | — | 450×427 | — | 12.54 |
| 4 | חדר שינה | 342×275 | 344×238 | 0.6/-13.5 | 7.66 |
| 5 | חדר רחצה כללי | 199×140 | 200×141 | 0.5/0.7 | 2.66 |
| 6 | חדר שינה הורים | 348×344 | 349×345 | 0.3/0.3 | 10.52 |
| 7 | פינת ארונות | 185×160 | 185×160 | 0.0/0.0 | 2.92 |
| 8 | חדר רחצה הורים | 212×210 | 193×151 | -9.0/-28.1 | 2.50 |
| 9 | מרפסת שמש | 474×270 | 337×204 | -28.9/-24.4 | 3.56 |
| 10 | כניסה | — | 413×218 | — | 3.90 |

## could not read / check

- room 'מבואה' (r-hall-auto-40): no closed region was traced around its label (the flood leaked or the label sits on a line)
- room 'חדר דיור' (r-living-room): no printed dimensions were read; its size comes from the drawing only
- room 'מטבח' (r-kitchen): no printed dimensions were read; its size comes from the drawing only
- room 'פינת אוכל' (r-dining-area): no printed dimensions were read; its size comes from the drawing only
- room 'חדר שינה' (r-bedroom): traced [344, 238] cm vs printed [275, 342] cm ([0.6, -13.5] %) — check the trace or the reading
- room 'חדר רחצה הורים' (r-master-bathroom): traced [193, 151] cm vs printed [212, 210] cm ([-9.0, -28.1] %) — check the trace or the reading
- room 'מרפסת שמש' (r-sun-terrace): traced [337, 204] cm vs printed [270, 474] cm ([-28.9, -24.4] %) — check the trace or the reading
- room 'כניסה' (r-entrance): no printed dimensions were read; its size comes from the drawing only