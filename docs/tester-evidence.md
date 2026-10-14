# Tester evidence and USB capture analysis

## What “Good” means

The default is **300 consecutive clean completed press/release cycles per output key**. OS auto-repeat does not count. A suspect resets that key's clean run; the suspect cycle itself does not count as clean. After a new clean run reaches the threshold the key returns to Good and leaves the active-suspect count. A later suspect turns it red again. Historical chatter counts remain in the session report until Reset. The earlier default of five cycles is migrated to 300; custom higher thresholds are preserved.

This is a screening target chosen for this app, not an industry certification threshold. Jack Ganssle's empirical switch study used **300 actuations per switch** with varied force and release techniques. It measured electrical bounce with a scope across different switch types, not modern keyboard reliability. It supports testing many actuations and varying technique; it does not validate this app's classification. [A Guide to Debouncing, pp. 1–3](https://www.ee.iitm.ac.in/~nagendra/E4332/2005/handouts/digital/ganssle_debouncing.pdf).

As statistical context, if independent, equally distributed presses had zero detectable failures, the exact one-sided 95% upper bound on failure probability would be `1 - 0.05^(1/n)`: roughly **45% at 5 presses**, **3% at 100**, **1% at 300**. This is an application of the binomial model, not a guarantee about a keyboard. Actual presses can be correlated and firmware/OS filtering can hide failures. [NIST: exact binomial confidence limits](https://itl.nist.gov/div898/software/dataplot/refman2/auxillar/exacbici.htm).

The default **20 ms re-press threshold** flags a down event arriving less than 20 ms after the preceding release of the same output key. It is deliberately labelled suspected chatter. Intentional fast taps and HE rapid trigger can produce the same pattern; adjust the threshold accordingly. This threshold differs from firmware debounce: [QMK's documented default debounce time](https://docs.qmk.fm/feature_debounce_type) is 5 ms, and firmware may use different algorithms or values.

ISO Non-US # is matched to the browser's Backslash position. Modified basic keys and tap-hold outputs are also resolved to their basic usage. Every suspected event appears as a red result chip. If its output is absent from the selected layout, the chip says “outside this layout.” Duplicate output mappings cannot identify which physical switch emitted an event. Untested keys are not automatically diagnosed as dead. The simultaneous-key maximum is observed rollover, not proof of unlimited NKRO.

## USB polling

The tester includes **offline USB capture analysis**. It does not install a capture driver or claim to capture live USB transfers. KeyboardEvent timestamps include human timing, firmware debounce, transport, OS dispatch and app scheduling. Their median is shown separately as key-event interval; it is never converted into a USB polling rate.

Use a USB capture tool appropriate to the OS. Export timestamps filtered to **completed input reports from one keyboard and one interrupt IN endpoint**. Exclude submissions, configuration traffic, other endpoints and duplicate records. The app cannot independently verify the provenance of imported timestamps.

Accepted files (up to 5 MB, at least 20 reports):

- CSV with a `frame.time_relative` column, as exported from Wireshark. This column uses seconds. `timestamp_ms`, `timestamp_us` and `timestamp_s` columns also select their units automatically.
- CSV with a `timestamp` or `time` column, or one numeric timestamp per line, using the selected unit.
- A JSON array of timestamps using the selected unit, or `{"unit":"ms","timestamps":[0,1,2,3,...]}`. Units can be `s`, `ms` or `us`.

Timestamps must be strictly increasing. The panel reports median interval, `1000 / median milliseconds`, p95 interval, range, report count, duration and an interval histogram. **Report cadence is not necessarily the bus polling schedule.** Idle report suppression, endpoint behavior and capture resolution can change the observed cadence. Packet traces provide evidence; application key events do not substitute for them.
