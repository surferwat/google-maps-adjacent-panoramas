## Description

Determines the adjacent panoramas that are to the left and to the right 
of a given panorama. Returns an array of string values for the pano ids of
the adjacent panoramas.

Input
* `mapCenterPoint` - `google.map.LatLng` that represents the geocodes for the center point of the map
* `activePanoramaPoint` - `google.map.LatLng` that represents the active Street View Panorama facing the map center

Output
```
["3baTzNhez12RsODEVyemAw", "NCuwqL9TEnxeVrH0qcezfQ"]

```
## Demo

* [hiirez](http://www.hiirez.com/)

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
npm run-script build
```

Step 4: Go to app folder and install the module

```
npm install /file/path/to/module
```

## Usage

```javascript
import { AdjacentStreetViewPanoramas } from 'google-maps-adjacent-panoramas'
import { Loader } from '@googlemaps/js-api-loader'

const mapCenterPoint = { lat: 40.6962047, lng: -73.9681279 } 
const activePanoramaPoint = { lat: 40.69603065823674, lng: -73.96814175806489 }

const loader = new Loader({
        apiKey: 'your api key'
        version: 'beta' // must use beta version as library uses promises
      })
      loader
      .load()
      .then(() => {
        const adjacentStreetViewPanoramas = new AdjacentStreetViewPanoramas(
          mapCenterPoint, 
          activePanoramaPoint, 
        )
        adjacentStreetViewPanoramas
          .getLocations()
          .then((data) => console.log(data))
          .error((e) => console.error(e))
      })
```

## Todo 

* [ ] Add tests

## References

* [Typescript and Google Maps](https://developers.google.com/maps/documentation/javascript/using-typescript)
* [Geometry Library](https://developers.google.com/maps/documentation/javascript/reference/geometry)
* [Street View Service](https://developers.google.com/maps/documentation/javascript/streetview#maps_streetview_service-javascript)