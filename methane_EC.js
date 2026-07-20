// 1. Study Area
//=========================================================

// "table" should be your imported Eastern Cape boundary

Map.centerObject(table,7);

Map.addLayer(table,{
  color:'white'
},'Eastern Cape Boundary');


//=========================================================
// 2. Load Sentinel-5P Methane
//=========================================================

var methane = ee.ImageCollection('COPERNICUS/S5P/OFFL/L3_CH4')

.select('CH4_column_volume_mixing_ratio_dry_air')

.filterDate('2022-09-01','2022-11-30')

.filterBounds(table);


//=========================================================
// 3. Mean Methane Concentration
//=========================================================

var meanCH4 = methane.mean().clip(table);

var methaneVis = {

  min:1800,

  max:1850,

  palette:[
    'black',
    'blue',
    'yellow',
    'red'
  ]

};

Map.addLayer(meanCH4,methaneVis,'Average Methane');


//=========================================================
// 4. Methane Hotspots
//=========================================================

// Areas above 1835 ppb are considered hotspots

var hotspots = meanCH4.gt(1835);

Map.addLayer(

hotspots.selfMask(),

{

palette:['red']

},

'Methane Hotspots'

);


//=========================================================
// 5. Methane Statistics
//=========================================================

var statistics = meanCH4.reduceRegion({

reducer:

ee.Reducer.mean()

.combine({

reducer2:ee.Reducer.min(),

sharedInputs:true

})

.combine({

reducer2:ee.Reducer.max(),

sharedInputs:true

})

.combine({

reducer2:ee.Reducer.stdDev(),

sharedInputs:true

}),

geometry:table,

scale:1000,

maxPixels:1e13

});

print('Methane Statistics');


//=========================================================
// 6. Sentinel-2 NDVI
//=========================================================

var sentinel = ee.ImageCollection('COPERNICUS/S2_SR_HARMONIZED')

.filterBounds(table)

.filterDate('2022-09-01','2022-11-30')

.filter(ee.Filter.lt('CLOUDY_PIXEL_PERCENTAGE',20))

.median();

var ndvi = sentinel.normalizedDifference(

['B8','B4'])

.rename('NDVI');

Map.addLayer(

ndvi.clip(table),

{

min:0,

max:1,

palette:[

'white',

'lightgreen',

'green',

'darkgreen'

]

},

'NDVI'

);


//=========================================================
// 7. Elevation
//=========================================================

var dem = ee.Image('USGS/SRTMGL1_003');

Map.addLayer(

dem.clip(table),

{

min:0,

max:2500,

palette:[

'green',

'yellow',

'brown',

'white'

]

},

'Elevation'

);


//=========================================================
// 8. Methane Time Series
//=========================================================

var chart = ui.Chart.image.series({

imageCollection:methane,

region:table,

reducer:ee.Reducer.mean(),

scale:1000

})

.setOptions({

title:'Average Methane Concentration',

hAxis:{

title:'Date'

},

vAxis:{

title:'CH4 (ppb)'

},

lineWidth:2,

pointSize:4

});

print(chart);


//=========================================================
// 9. Legend
//=========================================================

var legend = ui.Panel({

style:{

position:'bottom-left',

padding:'8px'

}

});

legend.add(

ui.Label({

value:'Methane (ppb)',

style:{

fontWeight:'bold'

}

})

);

var colors = [

'black',

'blue',

'yellow',

'red'

];

var labels = [

'1800',

'1817',

'1833',

'1850'

];

for(var i=0;i<colors.length;i++){

legend.add(

ui.Panel([

ui.Label('',{

backgroundColor:colors[i],

padding:'8px'

}),

ui.Label(labels[i])

],

ui.Panel.Layout.Flow('horizontal'))

);

}

Map.add(legend);


//=========================================================
// 10. Export Methane Raster
//=========================================================

Export.image.toDrive({

image:meanCH4,

description:'EasternCape_Methane_2022',

folder:'GEE',

region:table,

scale:1000,

maxPixels:1e13

});


//=========================================================
// 11. Export Statistics
//=========================================================

Export.table.toDrive({

collection:

ee.FeatureCollection([

ee.Feature(null,statistics)

]),

description:'EasternCape_CH4_Statistics',

fileFormat:'CSV'

});