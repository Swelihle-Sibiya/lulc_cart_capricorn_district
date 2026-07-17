//Swelihle Sinothile Sibiya//

var U = Studyarea;

Map.addLayer(Studyarea);
Map.centerObject(Studyarea, 10);

///data collection//
var ImgS2= ee.ImageCollection("COPERNICUS/S2_HARMONIZED")
.filter(ee.Filter.lt("CLOUDY_PIXEL_PERCENTAGE", 10));
var vis = {bands: ['B4', 'B3', 'B2'], max: 2000,gamma: 1.5};
var Darfur = ee.FeatureCollection(Studyarea);
var ImColA1 = ee.ImageCollection(ImgS2.filterDate('2022-07-01', '2022-10-30')  //// Filter by dates.
    .filterBounds(Studyarea));
    
/////Masks/////
//// Create a Cloud Mask.
function maskS2sr(image) {
  var cloudBitMask = ee.Number(2).pow(10).int(); ////cloud band
  var cirrusBitMask = ee.Number(2).pow(11).int();//// cirrus band
  
  var qa = image.select('QA60'); //// Get the pixel QA band.
  
  var mask = qa.bitwiseAnd(cloudBitMask).eq(0)  ////  Flags set to zero for clear conditions.
      .and(qa.bitwiseAnd(cirrusBitMask).eq(0)); ////  Flags set to zero for clear conditions.
  
  return image.updateMask(mask) //// Return the masked image, scaled to TOA reflectance, without the QA bands.,
      .copyProperties(image, ["system:time_start"]);
}

//// Add masks
var CM_ImColA1 = ImColA1.map(maskS2sr);
print(CM_ImColA1);

/////Resampling/////
var resample10 = function(image){
  var projection = image.select('B12').projection();
  var bands = image.select('B2','B3', 'B4', 'B5', 'B6','B7','B8','B8A','B11','B12');
  var resample = image.reproject({
      crs: projection,
      scale: 10
    });
  return bands.copyProperties(image,['system:time_start','system:time_end']);
};
var resmap_CM_ImColA1 = CM_ImColA1.map(resample10);
print(resmap_CM_ImColA1);

/////// Mosaic and Clip //////
var mosA1 = CM_ImColA1.mosaic().clip(Studyarea);
var mosA2 = resmap_CM_ImColA1.mosaic().clip(Studyarea);

var imageVisParam = {
  bands: ['B4', 'B3', 'B2'], // Specify the bands to visualize (e.g., RGB)
  min: 0, // Minimum pixel value
  max: 3000, // Maximum pixel value
  gamma: 1.4 // Gamma correction value (adjust as needed)
};

Map.addLayer(mosA1, imageVisParam, 'MosaicA1');
Map.addLayer(mosA2, imageVisParam, 'mosA2');

//Variant 1: Simple band operations
var nir = mosA2.select('B8');
var red = mosA2.select('B4');
var ndvi = nir.subtract(red).divide(nir.add(red)).rename('NDVI');
var mosA2 = mosA2.addBands(ndvi)
print(ndvi, 'NDVI')

// ... (previous code)

// Display the result.
var ndviParams = {min: -1, max: 1, palette: ['blue', 'white', 'green']};
Map.addLayer(ndvi, ndviParams, 'NDVI'); // Corrected line;

//def getEVI(image):
//Step 4: Calculate the EVI manually: 
//# Compute the EVI using an expression.
var EVI = mosA2.expression(
    '2.5 * ((NIR - RED) / (NIR + 6 * RED - 7.5 * BLUE + 1))', {
        'NIR': mosA2.select('B8').divide(10000),
        'RED': mosA2.select('B4').divide(10000),
        'BLUE': mosA2.select('B2').divide(10000)
    }).rename("EVI")

var mosA2 = mosA2.addBands(EVI)

//return(image)
print(EVI,'EVI')
// Display EVI result.
var EviParams = {min: -1, max: 1, palette: ['purple', 'white', 'green']};
Map.addLayer(EVI, EviParams, 'EVI');
//def SAVI(image):
//Step 8: Calculate the SAVI manually: 
//Variant 1: Simple band operations
var nir = mosA2.select('B8');
var red = mosA2.select('B4');

// Calculate SAVI using the expression function
var savi = mosA2.expression(
  '1.5 * ((NIR - RED) / (NIR + RED + 1.5))', 
  {
    NIR: nir,
    RED: red
  }
).rename("SAVI");
// Print the calculated SAVI band
var mosA2 = mosA2.addBands(savi)
print(savi);
// Display the result
var saviParams = {min: -1, max: 1, palette: ['brown', 'yellow', 'green']};
Map.addLayer(savi, saviParams, 'SAVI');

/////////////Stackinf NDVI,EVI, SAVI/////////////////

var NDVIEVIGNDVI = EVI.add(ndvi).add(savi);
var NDVIEVIGNDVIVisParams = { min: -1, max: 1, palette: ['blue', 'white', 'green'] };
Map.addLayer(NDVIEVIGNDVI, NDVIEVIGNDVIVisParams, 'NDVIEVIGNDVIGCI');


// Define classes for training//
var classes = [
  'waterbody',
  'vegetation',
  'builtup',
  'bareland'
];

// Merge all class features into a single feature collection
var points = ee.FeatureCollection([])
  .merge(waterbody.map(function (feature) {
  return feature.set('class', 0);
  }))
  .merge(vegetation.map(function (feature) {
    return feature.set('class', 1);
  }))
  .merge(builtup.map(function (feature) {
    return feature.set('class', 2);
  }))
  .merge(bareland.map(function (feature) {
    return feature.set('class', 3);
  }))

print(points,'training Data');
var label = 'class';
var bands = (['B2', 'B3', 'B4', 'B5', 'B6', 'B7', 'B8', 'B8A', 'B11', 'B12']);
var input = mosA2.select(bands);



// Randomly split the data into training and validation sets
var sample = points.randomColumn();
var trainingSample = sample.filter(ee.Filter.lte('random', 0.7));
var validationSample = sample.filter(ee.Filter.gt('random', 0.7));

// Overlay the training and validation points on the image to get training and validation data,
var training = mosA2.sampleRegions({
  collection: trainingSample,
  properties: ['class'],
  scale: 1000
});

var validation = mosA2.sampleRegions({
  collection: validationSample,
  properties: ['class'],
  scale: 1000
});

/// Classification Model
// Train a CART classifier (up to 10 leaf nodes in each tree) from the training sample.
var trainedClassifier = ee.Classifier.smileCart(10).train({
  features: training,
  classProperty: label,
  inputProperties: bands
});

// Get information about the trained classifier.
print('Results of trained classifier', trainedClassifier.explain());

// Classify the Sentinel-2 image using the trained classifier.
var ImgS2Classified = mosA2.classify(trainedClassifier);

// Add the classified image to the map.
var classVis = {
  min: 1,
  max: 9,
  palette: ['blue', 'lime', 'purple', 'yellow']
};

Map.addLayer(ImgS2Classified, classVis, 'CARTClassified');

 //// Accuracy Assessment

// Get a confusion matrix and overall accuracy for the training sample.

var trainAccuracy = trainedClassifier.confusionMatrix();

print('Training error matrix', trainAccuracy);

print('Training overall accuracy', trainAccuracy.accuracy());

var confMatrix = trainedClassifier.confusionMatrix()
 
 
var OA = confMatrix.accuracy()
var Kappa = confMatrix.kappa()
var PA = confMatrix.producersAccuracy()
var UA = confMatrix.consumersAccuracy()
 
print(confMatrix,'Confusion Matrix')
print(OA,'Overall Accuracy')
print(Kappa,'Kappa')
print(PA,'Producers Accuracy')
print(UA,'Users Accuracy')

//// Variable Importance

var explain = trainedClassifier.explain();

print(explain, 'Explain');


////// Export

Export.image.toDrive({

  image: ImgS2Classified,

  description: 'CARTClassified',

  region: Studyarea,

  scale: 120,

  fileFormat: 'GeoTIFF',

  maxPixels: 1e13,

});
