## Description

Google Maps API implementation that determines the panoramas (max 2) that are adjacent to a subject panorama and selects only those that are located in the relevant area which depends on the subject panorama's orientation (i.e., whether it is to the left of, in front of, or right of) to an origin point. 

So, if the subject panorama is to the left of the origin point, then two adjacent panoramas (if they are found) that are to the right of the subject panorama would be returned. If the subject panorama is in front of the origin point, then one adjacent panorama to the left of and one to the right of the subject panorama would be returned.

Input
* `origin` - `google.map.LatLng` that represents the geocodes for the point of interest
* `panorama` - `google.map.StreetViewPanorama` that represents the Street View Panorama facing the origin 
* `panoramaOrientation` - string enum (LEFT, CENTER, RIGHT) that represents the relative orientation of the panorama to the origin
* `[adjacentPanoramas1, adjacentPanoramas2]` - `google.maps.StreetViewPanorama[]` that represents that Street View Panoramas to be configured

Output
```
{
  panoramas: _an array of Street View Panoramas_,
  count: _number of panoramas that were configured_
}
```


## Installation

Step 1: Clone the repo 

```
git clone https://github.com/surferwat/google-maps-adjacent-panoramas.git
```

Step 2: Install the dependecies

```
cd <package_name>
npm install
```

Step 3: Build 
```
npm run-script build:clean
```

Step 4: Go to app folder and install the module

```
npm install /file/path/to/module
```

## Usage

```javascript
import { AdjacentStreetViewPanoramas } from 'google-maps-adjacent-panoramas'


const origin = { lat: 20.91592625, lng: -156.3812449 } 
const panorama = new google.maps.StreetViewPanorama(
    document.getElementById('pano-0')
)
const panoramaOrientation = 'LEFT'
const adjacentPanorama1 = new google.maps.StreetViewPanorama(
    document.getElementById('pano-1')
)
const adjacentPanorama2 = new google.maps.StreetViewPanorama(
    document.getElementById('pano-2')
)

function processSVData(data, status) {
  if (status === 'OK') {
    const location = data.location
    panorama.setPano(location.pano)
    panorama.setPov({
      heading: 270,
      pitch: 0,
    })
  } else {
    console.error('Street View data not found for this location.')
}

const sv = new google.maps.StreetViewService()
sv.getPanorama({ location: origin, radius: 50 }, processSVData)

const adjacentStreetViewPanoramas = new AdjacentStreetViewPanoramas(
    origin, 
    panorama, 
    panoramaOrientation,
    [adjacentPanorama1, adjacentPanorama2]
)
adjacentStreetViewPanoramas
    .configureAdjacentPanoramas()
    .then((data) => console.log(data))
    .error((e) => console.error(e))
```

## Todo 

* [ ] Add tests

## References

* [Typescript and Google Maps](https://developers.google.com/maps/documentation/javascript/using-typescript)
* [Geometry Library](https://developers.google.com/maps/documentation/javascript/reference/geometry)
* [Street View Service](https://developers.google.com/maps/documentation/javascript/streetview#maps_streetview_service-javascript)