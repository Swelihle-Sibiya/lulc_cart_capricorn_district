# Land Use / Land Cover Map — Capricorn District, Limpopo

A **Google Earth Engine (GEE)** workflow for supervised land use/land cover (LULC) classification of the **Capricorn District Municipality** (Limpopo Province, South Africa) using **Sentinel-2 MSI** imagery, spectral vegetation indices (NDVI, EVI, SAVI), and a **CART (Classification and Regression Trees)** classifier.

![Platform](https://img.shields.io/badge/platform-Google%20Earth%20Engine-4285F4?logo=google&logoColor=white)
![Sensor](https://img.shields.io/badge/sensor-Sentinel--2%20MSI-green)
![Classifier](https://img.shields.io/badge/classifier-CART-orange)
![Language](https://img.shields.io/badge/language-JavaScript%20(GEE%20Code%20Editor)-yellow)

---

## Overview

The script classifies the district into four LULC classes from a cloud-masked Sentinel-2 dry-season composite:

| Class value | Class       | Training features |
|-------------|-------------|-------------------|
| 0           | Waterbody   | 234               |
| 1           | Vegetation  | 304               |
| 2           | Built-up    | 489               |
| 3           | Bareland    | 111               |

The full pipeline: **image collection filtering → cloud/cirrus masking → resampling → mosaicking & clipping → index derivation (NDVI, EVI, SAVI) → training/validation split → CART training → classification → accuracy assessment → GeoTIFF export.**

## Study area

The area of interest is the Capricorn District Municipality boundary, maintained as a GEE **Table asset** (`projects/ee-snothilesbiya19/assets/CapricornDistrict`). The boundary was prepared/clipped in **QGIS** — the project file `Capricorn_district.qgz` in this repo documents that step — then uploaded to Earth Engine as a FeatureCollection asset and used for `filterBounds()`, `clip()`, and the export region.

## Data

| Dataset | ID | Role |
|---------|----|------|
| Sentinel-2 MSI, Level-1C (Harmonized) | `COPERNICUS/S2_HARMONIZED` | Spectral input |
| Capricorn District boundary | `projects/ee-snothilesbiya19/assets/CapricornDistrict` | Study area / clip mask |
| Training polygons (waterbody, vegetation, builtup, bareland) | GEE FeatureCollections (imports) | Classifier training/validation |

**Temporal filter:** 1 July – 30 October 2022 (dry season — reduces cloud contamination and improves built-up/bareland separability).
**Cloud filter:** `CLOUDY_PIXEL_PERCENTAGE < 10`.

## Methodology

### 1. Preprocessing

- **Cloud & cirrus masking** — bitwise mask on the `QA60` band (bit 10 = opaque clouds, bit 11 = cirrus); pixels flagged clear in both are retained, `system:time_start` is preserved for downstream filtering.
- **Resampling** — the 10-band subset (`B2–B8, B8A, B11, B12`) is reprojected to a common 10 m grid (projection taken from `B12`), harmonising the native 10 m/20 m band resolutions.
- **Mosaic & clip** — the masked collection is mosaicked and clipped to the district boundary. True-colour visualisation uses `B4/B3/B2`, max 3000, gamma 1.4.

### 2. Spectral indices

Computed from the clipped mosaic and appended as bands:

| Index | Formula | Purpose |
|-------|---------|---------|
| **NDVI** | `(NIR − RED) / (NIR + RED)` | General vegetation vigour |
| **EVI** | `2.5 × (NIR − RED) / (NIR + 6·RED − 7.5·BLUE + 1)` (reflectance scaled ÷10000) | Vegetation index with atmospheric/soil correction, less saturation over dense canopy |
| **SAVI** | `1.5 × (NIR − RED) / (NIR + RED + 1.5)` | Soil-adjusted index for sparse/semi-arid cover typical of Limpopo |

A stacked NDVI+EVI+SAVI composite layer is also rendered for visual comparison.

### 3. Training & classification

- Training features for the four classes are merged into a single FeatureCollection with an integer `class` property (0–3).
- **Split:** `randomColumn()` with a 70 / 30 training–validation partition.
- **Sampling:** `sampleRegions()` over the 10-band predictor stack (`B2, B3, B4, B5, B6, B7, B8, B8A, B11, B12`).
- **Classifier:** `ee.Classifier.smileCart(10)` — CART with a maximum of 10 leaf nodes, trained on the spectral bands.

### 4. Accuracy assessment

Reported from the classifier's confusion matrix:

- Confusion (error) matrix
- **Overall Accuracy (OA)**
- **Kappa coefficient**
- **Producer's Accuracy** (per-class, omission)
- **User's Accuracy** (per-class, commission)
- **Variable importance** via `trainedClassifier.explain()`

> Note: these metrics are computed on the *training* sample (resubstitution). For an independent estimate, classify the held-out 30% validation sample with `errorMatrix()`.

### 5. Export

The classified image is exported to Google Drive as a **GeoTIFF** (`CARTClassified`), clipped to the study area, at 120 m export scale with `maxPixels: 1e13`.

## Repository contents

```
Land-Use-Land-Cover-Map/
├── cart_lulc_capricorn.js     # GEE Code Editor script (classification pipeline)
├── Capricorn_district.qgz     # QGIS project used to prepare the district boundary
└── README.md
```

## How to run

1. Sign in to the [GEE Code Editor](https://code.earthengine.google.com/).
2. Upload the Capricorn District boundary as a Table asset (or request access to the existing asset) and add it to the script as the `Studyarea` import.
3. Add the four training FeatureCollections (`waterbody`, `vegetation`, `builtup`, `bareland`) as imports — digitise them as geometry imports or upload shapefiles as assets.
4. Paste the script into the Code Editor and click **Run**.
5. Inspect the layers (mosaics, NDVI/EVI/SAVI, `CARTClassified`) and the Console (confusion matrix, OA, Kappa, PA, UA, variable importance).
6. Start the export task from the **Tasks** tab to write the GeoTIFF to Google Drive.

## Requirements

- Google Earth Engine account (Code Editor access)
- QGIS ≥ 3.x (only if reproducing the boundary preparation from `Capricorn_district.qgz`)
- Google Drive space for the exported GeoTIFF

## Possible improvements

- Validate on the independent 30% sample (`validation.classify(trainedClassifier).errorMatrix('class', 'classification')`) rather than training data only
- Add the derived indices (NDVI/EVI/SAVI) to `inputProperties` so the classifier actually uses them as predictors
- Compare CART against Random Forest (`smileRandomForest`) and SVM
- Use the Cloud Score+ / s2cloudless collections for more robust cloud masking than QA60
- Export at 10–20 m to preserve classification detail (current export scale is 120 m)
- Align the classified-layer visualisation (`min`/`max`) with the actual class range 0–3
