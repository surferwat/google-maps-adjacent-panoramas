/*
Determines the adjacent panoramas that are to the left and to the right 
of a given panorama.

Each Google Streetview Panorama object has a property named links, which 
is an array of link objects. The array could have min 0 or max 4 link 
objects with each representing the details for an adjacent panorama that 
is either in front of, to the right of, to the back of, or to the left of 
the active panorama.

The link object has three properties named id, heading, and description. 
The heading property is a number that represents the direction in degrees
to the location (i.e., coordinates) of the adjacent panorama. With this 
heading, we can ascertain the location of the adjacent panorama relative 
to the active panorama.

We first compute the heading from the location of the active panorama to 
the location of the map center. We label this heading as the active heading. 
We then use the active heading to compute the headings that will make 
up the parameters that correspond to the different positions.We compute 
these parameter headings such that: 
    parameterHeadings[0] == activeHeading + 45, 
    parametersHeadings[1] == parametersHeadings[0] + 90 * [1],
    parametersHeadings[2] == parametersHeadings[0] + 90 * [2],
    parametersHeadings[3] == parametersHeadings[0] + 90 * [3]

We then take two parameter headings to create a range of headings that 
correspond to the directions where we can find adjacent panoramas 
that are either to the front of, to the right of, to the back of, or to
the left of the active panorama. The following reprsents each of these 
pairs:
    parameterHeadings[0] and parameterHeadings[1] == _right of_ 
    parameterHeadings[1] and parameterHeadings[2] == _back of_ 
    parameterHeadings[0] and parameterHeadings[1] == _left of_ 
    parameterHeadings[0] and parameterHeadings[1] == _front of_

Sample return value:
    ["3baTzNhez12RsODEVyemAw", "NCuwqL9TEnxeVrH0qcezfQ"]
*/

const MAX_NUM_HEADINGS = 4

class AdjacentStreetViewPanoramaLocations {
    private _mapCenterPoint: google.maps.LatLng 
    private _activePanoramaPoint: google.maps.LatLng 
    private _adjacentPanoramaPanos: (string | null)[] = [] // [0] == left side panorama and [1] == right side

    constructor(
        initMapCenterPoint: google.maps.LatLng, 
        initActivePanoramaPoint: google.maps.LatLng, 
    ) {
        this._mapCenterPoint = initMapCenterPoint,
        this._activePanoramaPoint = initActivePanoramaPoint
    }

    // Compute heading from panorama point to map center point 
    private activeHeading() {
        return google.maps.geometry.spherical.computeHeading(this._activePanoramaPoint, this._mapCenterPoint)
    }

    // Compute parameter headings
    private parameterHeadings(activeHeading: number) {
        let parameterHeadings: number[] = []
        
        let heading = 0
        for (let i = 0; i < MAX_NUM_HEADINGS; i++) {
            if (i == 0) {
                heading = (activeHeading + 45) % 360
            } else {
                heading = (heading + 90) % 360
            }
            parameterHeadings.push(heading)
        }
        return parameterHeadings
    }

    // Convert heading to a number that is between 0 to 360 degrees
    private zeroTo360(heading: number) {
        return heading < 0 ? heading + 360 : heading
    }

    // Checks for adjacent panoramas that are to the left of active panoarama
    private isLeftLink(heading: number, parameterHeadings: number[]) {
        if ((parameterHeadings[2] + 90) > 360) {
            return (heading > parameterHeadings[2] && heading <= 360 
                || (heading >= 0 && heading < (parameterHeadings[2] + 90) % 360))
        }
        return (heading > parameterHeadings[2] && heading < parameterHeadings[2] + 90)
    }

    // Checks for adjacent panoramas that are to the right of active panoarama
    private isRightLink(heading: number, parameterHeadings: number[]) {
        if ((parameterHeadings[0] + 90) > 360) {
            return (heading > parameterHeadings[0] && heading <= 360 
                || (heading >= 0 && heading < (parameterHeadings[0] + 90) % 360))
        }
        return (heading > parameterHeadings[0] && (heading < parameterHeadings[0] + 90))
    }

    // Get panos for adjacent panoramas 
    async getLocations(): Promise<(string | null)[]> {
        let activePoint = this._activePanoramaPoint
        let links: (google.maps.StreetViewLink | undefined)[] | undefined
    
        const streetViewService = new google.maps.StreetViewService()
        const request = {
            location: {lat: activePoint.lat(), lng: activePoint.lng()},
            radius: 100,
            source: google.maps.StreetViewSource.OUTDOOR
        }
        const result = await streetViewService.getPanorama(request)
            
        if (result == null) {
            return this._adjacentPanoramaPanos
        }
            
        links = result.data.links
            
        if (links == null) { 
            throw new Error('Street View Links not found for this panorama')
        }

        const activeHeading = this.activeHeading()
        const parameterHeadings = this.parameterHeadings(activeHeading)
        
        for (let i = 0; i < links.length; i++) {
           if (links[i] == null) {
               continue
           }

           if (links[i]!.heading == null) {
               continue
           }
        
           if (this.isLeftLink(this.zeroTo360(links[i]!.heading!), parameterHeadings)) {
               this._adjacentPanoramaPanos[0] = links[i]!.pano
           } else if (this.isRightLink(this.zeroTo360(links[i]!.heading!), parameterHeadings)) {
               this._adjacentPanoramaPanos[1] = links[i]!.pano
           }
        }

        return this._adjacentPanoramaPanos
    }
}

export { AdjacentStreetViewPanoramaLocations }