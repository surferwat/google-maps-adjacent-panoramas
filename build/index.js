"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AdjacentStreetViewPanoramaLocations = void 0;
const NUMBER_OF_ADJACENT_PANORAMAS = 2; // must be an even number
var PanoramaOrientation;
(function (PanoramaOrientation) {
    PanoramaOrientation["LeftOf"] = "LEFTOF";
    PanoramaOrientation["FrontOf"] = "FRONTOF";
    PanoramaOrientation["RightOf"] = "RIGHTOF";
})(PanoramaOrientation || (PanoramaOrientation = {}));
class AdjacentStreetViewPanoramaLocations {
    constructor(initMapCenterPoint, initMainPanoramaPoint, initMainPanoramaOrientation) {
        this._mainPanoramaOrientation = PanoramaOrientation.FrontOf; // default is _FrontOf_
        this._adjacentPanoramaPanosAndPoints = [];
        this._mapCenterPoint = initMapCenterPoint,
            this._mainPanoramaPoint = initMainPanoramaPoint,
            this._mainPanoramaOrientation = initMainPanoramaOrientation;
    }
    heading(heading) {
        let x = heading;
        if (heading > 180) {
            if (x < 0)
                x = 180 - Math.abs(x) % 180;
            if (x > 0)
                x = Math.abs(x) % 180 - 180;
        }
        return x;
    }
    headings(referenceHeading) {
        let startHeading = referenceHeading % 90
            ? referenceHeading + 45
            : referenceHeading;
        startHeading = this.heading(startHeading); // translate to google format [-180,180)
        const maxHeadings = 4;
        let headings = [];
        for (let i = 0; i < maxHeadings; i++) {
            let heading;
            if (i == 0) {
                heading = startHeading;
            }
            else {
                heading = startHeading + (90 * i);
            }
            const formatted = this.heading(heading); // translate to google format [-180,180)
            headings.push(formatted);
        }
        return headings; // [aHeading, bHeading, cHeading, dHeading]
    }
    points(pPoint, distance, headings) {
        const maxPoints = 4;
        let points = [];
        for (let i = 0; i < maxPoints; i++) {
            const point = google.maps.geometry.spherical.computeOffset(pPoint, distance * 2, headings[i]);
            points.push(point);
        }
        return points; // [aPoint, bPoint, cPoint, dPoint]
    }
    vector(startPoint, endPoint) {
        return [
            endPoint.lng() - startPoint.lng(),
            endPoint.lat() - startPoint.lat()
        ];
    }
    vectors(startPoint, endPoints) {
        let vectors = [];
        for (let i = 0; i < endPoints.length; i++) {
            let vector = this.vector(startPoint, endPoints[i]);
            vectors.push(vector);
        }
        return vectors; // [pAVector, pBVector, pCVector, pDVector]
    }
    dotProduct(vector1, vector2, size) {
        let dp = 0;
        for (let i = 0; i < size; i++) {
            dp += vector1[i] * vector2[i];
        }
        return dp;
    }
    /**
     * Takes two vectors that together represent either the area right, back, left, or front of
     * the main panoroma point and calculates the dot product of each with the vector that
     * represents the adjacent panoroma point. The angle between the two perimeter vectors
     * is 90 degrees, so if the dot products are positive, then the angles between the perimeter
     * vectors and the adjacent panorama vector is less than 90 degrees and thus we know that
     * the adjacent panorama vector is in between the perimeter vectors.
     * @param vectors
     * @param newVector
     */
    isInArea(vectors, newVector) {
        const dPOfLeftVectorAndSubjectVector = this.dotProduct(vectors[0], newVector, 2);
        const dPOfRightVectorAndSubjectVector = this.dotProduct(vectors[1], newVector, 2);
        const locatedInArea = (dPOfLeftVectorAndSubjectVector > 0 && dPOfRightVectorAndSubjectVector > 0);
        return locatedInArea;
    }
    /**
     * Retrieves the _google.maps.LatLng_ for panoramas adjacent to the main panorama.
     * Adjacent means on the left- and/or right-hand side of the main panorama depending on the orientation of the main panorama).
     */
    async getLocations() {
        //// We need to determine the area that represents the right, back, left, or front area for a given 
        //// point in a 2D plane. We do this by figuring out each pair of vectors that represent the sides
        //// for a given area.
        console.log('map center point', this._mapCenterPoint.lat(), this._mapCenterPoint.lng());
        console.log('main panorama point', this._mainPanoramaPoint.lat(), this._mainPanoramaPoint.lng());
        const distanceBetweenPPointAndOPoint = google.maps.geometry.spherical.computeDistanceBetween(this._mainPanoramaPoint, this._mapCenterPoint);
        const pPointToMapCenterPointHeading = google.maps.geometry.spherical.computeHeading(this._mainPanoramaPoint, this._mapCenterPoint);
        const headings = this.headings(pPointToMapCenterPointHeading);
        console.log('headingA', headings[0]);
        console.log('headingB', headings[1]);
        console.log('headingC', headings[2]);
        console.log('headingD', headings[3]);
        const points = this.points(this._mainPanoramaPoint, distanceBetweenPPointAndOPoint, headings);
        const vectors = this.vectors(this._mainPanoramaPoint, points);
        const areaVectors = {
            right: [vectors[0], vectors[1]],
            back: [vectors[1], vectors[2]],
            left: [vectors[2], vectors[3]],
            front: [vectors[3], vectors[0]]
        };
        let activePoint = this._mainPanoramaPoint;
        let links;
        let count = 0; // keep track of number of links to relevant adjacent panoramas found
        const streetViewService = new google.maps.StreetViewService();
        for (let i = 0; i < NUMBER_OF_ADJACENT_PANORAMAS; i++) {
            const request = {
                location: { lat: activePoint.lat(), lng: activePoint.lng() },
                radius: 100,
                source: google.maps.StreetViewSource.OUTDOOR
            };
            const result = await streetViewService.getPanorama(request);
            if (result == null) {
                continue;
            }
            links = result.data.links;
            if (links == null) {
                throw new Error('Street View Links not found for this panorama');
            }
            //// We then loop through each of the links (i.e., the adjacent panoramas) searching for the link 
            //// for the panorama that is located in the target area (e.g., if the orientation of the subject panorama 
            //// is on the left-hand side of a map center point, then our target area would be represented by the area 
            //// to the right of the subject panorama). Each panorama may have up to four links (this is an assumption) for
            //// each of the possible directions that one can move from a given panorama (i.e., right, backward, left, forward).
            let targetLinkFound = false;
            for (let j = 0; j < links.length; j++) {
                // Set position (i.e., geocodes) of link 
                const link = links[j];
                if (link == null) {
                    continue;
                }
                const streetViewPanoRequest = { pano: link.pano };
                const result = await streetViewService.getPanorama(streetViewPanoRequest);
                if (result == null) {
                    continue;
                }
                if (result.data.location == null) {
                    continue;
                }
                const panoramaLink = {
                    pano: result.data.location.pano,
                    point: result.data.location.latLng || { lat: () => 0, lng: () => 0 }
                };
                if (panoramaLink.pano == null) {
                    continue;
                }
                // Set vector for panorama point and link point
                const pLVector = this.vector(this._mainPanoramaPoint, panoramaLink.point);
                // Check whether link point is located in the target area
                switch (true) {
                    case this._mainPanoramaOrientation == 'LEFTOF':
                        if (this.isInArea(areaVectors.right, pLVector)) {
                            this._adjacentPanoramaPanosAndPoints[i] = panoramaLink;
                            count++;
                            targetLinkFound = true;
                        }
                        break;
                    case this._mainPanoramaOrientation == 'RIGHTOF':
                        if (this.isInArea(areaVectors.left, pLVector)) {
                            this._adjacentPanoramaPanosAndPoints[i] = panoramaLink;
                            count++;
                            targetLinkFound = true;
                        }
                        break;
                    case this._mainPanoramaOrientation == 'FRONTOF':
                        // Check left area for first, then check right area second
                        if (i < NUMBER_OF_ADJACENT_PANORAMAS / 2) {
                            if (this.isInArea(areaVectors.left, pLVector)) {
                                this._adjacentPanoramaPanosAndPoints[i] = panoramaLink;
                                count++;
                                targetLinkFound = true;
                            }
                            else {
                                break;
                            }
                        }
                        else {
                            if (this.isInArea(areaVectors.right, pLVector)) {
                                this._adjacentPanoramaPanosAndPoints[i] = panoramaLink;
                                count++;
                                targetLinkFound = true;
                            }
                            else {
                                break;
                            }
                        }
                        break;
                    default:
                        throw new Error('invalid orientation');
                }
                // We can exit the inner loop because we no longer have to check the other 
                // links as we have already found one in the target area
                if (targetLinkFound)
                    break;
            }
            // If the main panorama orientation is _LEFTOF_ or _RIGHTOF_, then when no link in 
            // the target area is found, we should exit the main loop. However, if the main panorama
            // orientation is _FRONTOF_, then if no link is found going left, we still should
            // check whether we can find a link going right.
            if (!targetLinkFound) {
                if (this._mainPanoramaOrientation !== 'FRONTOF') {
                    break;
                }
                else if (i >= NUMBER_OF_ADJACENT_PANORAMAS / 2) {
                    // Going right, so exit the main loop if no link found
                    break;
                }
                else {
                    // Going left, so just continue with the next iteration of the main loop
                    // If next iteration is still going left, then _activePoint_ won't change,
                    // so we'll end up here again, until next iteration is going right
                    continue;
                }
            }
            // Assign the the link point as the active point. If the main panorama orientation is 
            // _FRONTOF_, then we look for links to the left of the main panorama for half of the 
            // value assigned to _NUMBER_OF_ADJACENT_PANORAMAS, so once we reach that half way point
            // we need to assign the active point as the main panorama point. That way, we can look 
            // for links to the right of the main panorama.
            if (this._mainPanoramaOrientation == 'FRONTOF' && i == (NUMBER_OF_ADJACENT_PANORAMAS / 2 - 1)) {
                activePoint = this._mainPanoramaPoint;
            }
            else {
                activePoint = this._adjacentPanoramaPanosAndPoints[i].point;
            }
        }
        return {
            panosAndPoints: this._adjacentPanoramaPanosAndPoints,
            count: count
        };
    }
}
exports.AdjacentStreetViewPanoramaLocations = AdjacentStreetViewPanoramaLocations;
// const NUMBER_OF_ADJACENT_PANORAMAS = 2 // must be an even number
// enum PanoramaOrientation {
//     LeftOf = 'LEFTOF',
//     FrontOf = 'FRONTOF',
//     RightOf = 'RIGHTOF'
// }
// type Result = {
//     panoramas: google.maps.StreetViewPanorama[],
//     count: number
// }
// class AdjacentStreetViewPanoramas {
//     private _mapCenterPoint: google.maps.LatLng
//     private _subjectStreetViewPanorama: google.maps.StreetViewPanorama
//     private _subjectStreetViewPanoramaOrientation: PanoramaOrientation = PanoramaOrientation.FrontOf // default is _FrontOf_
//     private _adjacentStreetViewPanoramas: google.maps.StreetViewPanorama[]
//     constructor(
//         initMapCenterPoint: google.maps.LatLng, 
//         initSubjectStreetViewPanorama: google.maps.StreetViewPanorama, 
//         initSubjectStreetViewPanoramaOrientation: PanoramaOrientation,
//         initAdjacentStreetViewPanoramas: google.maps.StreetViewPanorama[] 
//     ) {
//         this._mapCenterPoint = initMapCenterPoint,
//         this._subjectStreetViewPanorama = initSubjectStreetViewPanorama,
//         this._subjectStreetViewPanoramaOrientation = initSubjectStreetViewPanoramaOrientation,
//         this._adjacentStreetViewPanoramas = initAdjacentStreetViewPanoramas
//     }
//     private heading(heading: number): number {
//         let x: number = heading
//         if (x > 180) {
//             if (x < 0) x = 180 - Math.abs(x)%180
//             if (x > 0) x = Math.abs(x)%180 - 180
//         }
//         return x
//     }
//     private headings(referenceHeading: number): number[] {
//         const startHeading: number = referenceHeading%90 
//             ? referenceHeading + 45 
//             : referenceHeading
//         const maxHeadings = 4
//         let headings: number[] = []
//         for (let i=0; i<maxHeadings; i++) {
//             let heading: number
//             if (i == 0) {
//                 heading = startHeading
//             } else {
//                 heading = this.heading(startHeading + (90*i))
//             }
//             headings.push(heading)
//         }
//         return headings // [aHeading, bHeading, cHeading, dHeading]
//     }
//     private points(pPoint: google.maps.LatLng, distance: number, headings: number[]): google.maps.LatLng[] {
//         const maxPoints = 4 
//         let points: google.maps.LatLng[] = []
//         for (let i=0; i<maxPoints; i++) {
//             const point: google.maps.LatLng = google.maps.geometry.spherical.computeOffset(pPoint, distance * 2, headings[i])
//             points.push(point)
//         }
//         return points // [aPoint, bPoint, cPoint, dPoint]
//     }
//     private vector(startPoint: google.maps.LatLng, endPoint: google.maps.LatLng): number[] {
//         return [
//             endPoint.lng() - startPoint.lng(), 
//             endPoint.lat() - startPoint.lat() 
//         ]
//     }
//     private vectors(startPoint: google.maps.LatLng, endPoints: google.maps.LatLng[]): number[][] {
//         let vectors: number[][] = []
//         for (let i=0; i<endPoints.length; i++) {
//             let vector: number[] = this.vector(startPoint, endPoints[i])
//             vectors.push(vector)
//         }
//         return vectors // [pAVector, pBVector, pCVector, pDVector]
//     }
//     private vectorProduct(vector1: number[], vector2: number[], size: number): number {
//         let sp: number = 0
//         for (let i = 0; i < size; i++) {
//             sp =+ vector1[i] * vector2[i]
//         }
//         return sp
//     }
//     private isInArea(area: number[][], newVector: number[]): boolean {
//         let locatedInArea: boolean = false 
//         if (this.vectorProduct(area[0], newVector, 2) > 0 && this.vectorProduct(area[1], newVector, 2) > 0) {
//             locatedInArea = true
//         }
//         return locatedInArea
//     }
//     /**
//      * Updates each Street View Panorama object with the pano ID for a panorama adjacent to the subject panorama. 
//      * Adjacent means on the left- and/or right-hand side of the subject panorama depending on the orientation of the subject panorama).
//      */
//     configureAdjacentPanoramas(): Result {
//         let activePanorama: google.maps.StreetViewPanorama = this._subjectStreetViewPanorama
//         let count: number = 0 // keep track of number of panoramas configured
//         for(let i=0; i<NUMBER_OF_ADJACENT_PANORAMAS; i++) {
//             const links: (google.maps.StreetViewLink | null)[] | null = activePanorama.getLinks()
//             if (links == null) { 
//                 throw new Error('Street View Links not found for this panorama')
//             } // non-null assertion used with _links_ below because we know links are not null by this line
//             const pPoint: google.maps.LatLng | null = activePanorama.getPosition()
//             if (pPoint == null) {
//                 throw new Error('Street View LatLng not found for this panorama')
//             }
//             //// We need to determine the area that represents the right, back, left, or front area for a given 
//             //// point in a 2D plane. We do this by figuring out each pair of vectors that represent the sides
//             //// for a given area.
//             const distanceBetweenPPointAndOPoint: number = google.maps.geometry.spherical.computeDistanceBetween(pPoint, this._mapCenterPoint)
//             const pPointToMapCenterPointHeading: number = google.maps.geometry.spherical.computeHeading(pPoint, this._mapCenterPoint)
//             const headings: number[] = this.headings(pPointToMapCenterPointHeading)
//             const points: google.maps.LatLng[] = this.points(pPoint, distanceBetweenPPointAndOPoint, headings)
//             const vectors: number[][] = this.vectors(pPoint, points)
//             const areaVectors = {
//                 right: [vectors[0], vectors[1]],
//                 back: [vectors[1], vectors[2]],
//                 left: [vectors[2], vectors[3]],
//                 front: [vectors[3], vectors[0]]
//             }
//             //// We then loop through each of the links (i.e., the adjacent panoramas) searching for the link 
//             //// for the panorama that is located in the target area (e.g., if the orientation of the subject panorama 
//             //// is on the left-hand side of a map center point, then our target area would be represented by the area 
//             //// to the right of the subject panorama). Each panorama may have up to four links (this is an assumption) for
//             //// each of the possible directions that one can move from a given panorama (i.e., right, backward, left, forward).
//             let panoramaConfigured: boolean = false
//             for (let j=0; j<links.length; j++) {
//                 function setLinkPointCallBack(
//                     data: google.maps.StreetViewPanoramaData | null, 
//                     status: google.maps.StreetViewStatus
//                 ): void {
//                     if (status === 'OK') {
//                         const location = data ? data.location : null
//                         linkPoint = location ? location.latLng : null
//                     } else {
//                         console.warn('Street View data not found for this location; moving to next iteration, if any')
//                     }
//                 }
//                 function setAdjacentPanoramaCallBack(
//                     data: google.maps.StreetViewPanoramaData | null, 
//                     status: google.maps.StreetViewStatus,
//                 ): void {
//                     if (status === 'OK') {
//                         const link: google.maps.StreetViewLink | null = links![j]
//                         const pano: string | null = link != null ? link.pano : null
//                         if (pano != null) this._adjacentStreetViewPanoramas[i].setPano(pano)
//                         panoramaConfigured = true
//                         count++
//                     } else {
//                         console.warn('Street View data not found for this location; panorama in this iteration has not been updated')
//                     }
//                 }
//                 // Set position (i.e., geocodes) of link 
//                 let linkPoint: google.maps.LatLng | null | undefined
//                 if (linkPoint == null) continue  // check if null or undefined
//                 const streetViewService = new google.maps.StreetViewService()
//                 const link: google.maps.StreetViewLink | null = links![j]
//                 const streetViewPanoRequest: google.maps.StreetViewPanoRequest | null = link != null ? link.pano as google.maps.StreetViewPanoRequest : null
//                 if (streetViewPanoRequest != null) streetViewService.getPanorama(streetViewPanoRequest, setLinkPointCallBack)
//                 // Set vector for panorama point and link point
//                 const pLVector: number[] = this.vector(pPoint, linkPoint)
//                 // Check whether link point is located in the target area
//                 let targetLinkFound: boolean = false
//                 switch (true) { 
//                     case this._subjectStreetViewPanoramaOrientation == 'LEFTOF':
//                         if (this.isInArea(areaVectors.right, pLVector)) {
//                             const link: google.maps.StreetViewLink | null = links![j]
//                             const streetViewPanoRequest: google.maps.StreetViewPanoRequest | null = link != null ? link.pano as google.maps.StreetViewPanoRequest : null
//                             if (streetViewPanoRequest != null) streetViewService.getPanorama(streetViewPanoRequest, setAdjacentPanoramaCallBack)
//                             targetLinkFound = true
//                         }
//                         break 
//                     case this._subjectStreetViewPanoramaOrientation == 'RIGHTOF':
//                         if (this.isInArea(areaVectors.left, pLVector)) {
//                             const link: google.maps.StreetViewLink | null = links![j]
//                             const streetViewPanoRequest: google.maps.StreetViewPanoRequest | null = link != null ? link.pano as google.maps.StreetViewPanoRequest : null
//                             if (streetViewPanoRequest != null) streetViewService.getPanorama(streetViewPanoRequest, setAdjacentPanoramaCallBack)
//                             targetLinkFound = true 
//                         }
//                         break
//                     case this._subjectStreetViewPanoramaOrientation == 'FRONTOF':
//                         // Check left area for first, then check right area second
//                         if (j < NUMBER_OF_ADJACENT_PANORAMAS/2) {
//                             if (this.isInArea(areaVectors.left, pLVector)) {
//                                 const link: google.maps.StreetViewLink | null = links![j]
//                                 const streetViewPanoRequest: google.maps.StreetViewPanoRequest | null = link != null ? link.pano as google.maps.StreetViewPanoRequest : null
//                                 if (streetViewPanoRequest != null) streetViewService.getPanorama(streetViewPanoRequest, setAdjacentPanoramaCallBack)
//                                 targetLinkFound = true
//                             } else {
//                                 break
//                             }
//                         } else {
//                             if (this.isInArea(areaVectors.right, pLVector)) {
//                                 const link: google.maps.StreetViewLink | null = links![j]
//                                 const streetViewPanoRequest: google.maps.StreetViewPanoRequest | null = link != null ? link.pano as google.maps.StreetViewPanoRequest : null
//                                 if (streetViewPanoRequest != null) streetViewService.getPanorama(streetViewPanoRequest, setAdjacentPanoramaCallBack)
//                                 targetLinkFound = true
//                             } else {
//                                 break
//                             }
//                         }
//                         break
//                     default:
//                         throw new Error('invalid orientation')
//                 }
//                 if (targetLinkFound) break
//             }
//             if (!panoramaConfigured) break 
//             activePanorama = this._adjacentStreetViewPanoramas[i]
//         }
//         return {
//             panoramas: this._adjacentStreetViewPanoramas,
//             count: count
//         }
//     }
// }
// export { AdjacentStreetViewPanoramas }
// const NUMBER_OF_ADJACENT_PANORAMAS = 2 // must be an even number
// enum PanoramaOrientation {
//     LeftOf = 'LEFTOF',
//     FrontOf = 'FRONTOF',
//     RightOf = 'RIGHTOF'
// }
// type Result = {
//     points: google.maps.LatLng[],
//     count: number
// }
// class AdjacentStreetViewPanoramas {
//     private _mapCenterPoint: google.maps.LatLng
//     private _mainPanoramaPoint: google.maps.LatLng
//     private _mainPanoramaOrientation: PanoramaOrientation = PanoramaOrientation.FrontOf // default is _FrontOf_
//     private _adjacentPanoramaPoints: google.maps.LatLng[] = []
//     constructor(
//         initMapCenterPoint: google.maps.LatLng, 
//         initMainPanoramaPoint: google.maps.LatLng, 
//         initMainPanoramaOrientation: PanoramaOrientation,
//     ) {
//         this._mapCenterPoint = initMapCenterPoint,
//         this._mainPanoramaPoint = initMainPanoramaPoint,
//         this._mainPanoramaOrientation = initMainPanoramaOrientation
//     }
//     private heading(heading: number): number {
//         let x: number = heading
//         if (heading > 180) {
//             if (x < 0) x = 180 - Math.abs(x)%180
//             if (x > 0) x = Math.abs(x)%180 - 180
//         }
//         return x
//     }
//     private headings(referenceHeading: number): number[] {
//         let startHeading: number = referenceHeading%90 
//             ? referenceHeading + 45 
//             : referenceHeading
//         startHeading = this.heading(startHeading) // translate to google format [-180,180)
//         const maxHeadings = 4
//         let headings: number[] = []
//         for (let i=0; i<maxHeadings; i++) {
//             let heading: number
//             if (i == 0) {
//                 heading = startHeading
//             } else {
//                 heading = startHeading + (90*i)
//             }
//             const formatted = this.heading(heading) // translate to google format [-180,180)
//             headings.push(formatted)
//         }
//         return headings // [aHeading, bHeading, cHeading, dHeading]
//     }
//     private points(pPoint: google.maps.LatLng, distance: number, headings: number[]): google.maps.LatLng[] {
//         const maxPoints = 4 
//         let points: google.maps.LatLng[] = []
//         for (let i=0; i<maxPoints; i++) {
//             const point: google.maps.LatLng = google.maps.geometry.spherical.computeOffset(pPoint, distance * 2, headings[i])
//             points.push(point)
//         }
//         return points // [aPoint, bPoint, cPoint, dPoint]
//     }
//     private vector(startPoint: google.maps.LatLng, endPoint: google.maps.LatLng): number[] {
//         return [
//             endPoint.lng() - startPoint.lng(), 
//             endPoint.lat() - startPoint.lat() 
//         ]
//     }
//     private vectors(startPoint: google.maps.LatLng, endPoints: google.maps.LatLng[]): number[][] {
//         let vectors: number[][] = []
//         for (let i=0; i<endPoints.length; i++) {
//             let vector: number[] = this.vector(startPoint, endPoints[i])
//             vectors.push(vector)
//         }
//         return vectors // [pAVector, pBVector, pCVector, pDVector]
//     }
//     private dotProduct(vector1: number[], vector2: number[], size: number): number {
//         let dp: number = 0
//         for (let i = 0; i < size; i++) {
//             dp =+ vector1[i] * vector2[i]
//         }
//         return dp
//     }
//     private isInArea(area: number[][], newVector: number[]): boolean {
//         let locatedInArea: boolean = (this.dotProduct(area[0], newVector, 2) > 0 && this.dotProduct(area[1], newVector, 2) < 0)
//         return locatedInArea
//     }
//     /**
//      * Retrieves the pano IDs for panoramas adjacent to the main panorama. 
//      * Adjacent means on the left- and/or right-hand side of the main panorama depending on the orientation of the main panorama).
//      */
//     async getAdjacentPanoramaPanos(): Promise<Result> {
//         //// We need to determine the area that represents the right, back, left, or front area for a given 
//         //// point in a 2D plane. We do this by figuring out each pair of vectors that represent the sides
//         //// for a given area.
//         const distanceBetweenPPointAndOPoint: number = google.maps.geometry.spherical.computeDistanceBetween(this._mainPanoramaPoint, this._mapCenterPoint)
//         const pPointToMapCenterPointHeading: number = google.maps.geometry.spherical.computeHeading(this._mainPanoramaPoint, this._mapCenterPoint)
//         const headings: number[] = this.headings(pPointToMapCenterPointHeading)
//         const points: google.maps.LatLng[] = this.points(this._mainPanoramaPoint, distanceBetweenPPointAndOPoint, headings)
//         const vectors: number[][] = this.vectors(this._mainPanoramaPoint, points)
//         const areaVectors = {
//             right: [vectors[0], vectors[1]],
//             back: [vectors[1], vectors[2]],
//             left: [vectors[2], vectors[3]],
//             front: [vectors[3], vectors[0]]
//         }
//         let activePoint = this._mainPanoramaPoint
//         let links: (google.maps.StreetViewLink | undefined)[] | undefined
//         let count: number = 0 // keep track of number of links to relevant adjacent panoramas found
//         const streetViewService = new google.maps.StreetViewService()
//         for(let i=0; i<NUMBER_OF_ADJACENT_PANORAMAS; i++) {
//             const request = {
//                 location: {lat: activePoint.lat(), lng: activePoint.lng()},
//                 radius: 100,
//                 source: google.maps.StreetViewSource.OUTDOOR
//             }
//             const result = await streetViewService.getPanorama(request)
//             if (result == null) {
//                 continue
//             }
//             links = result.data.links
//             if (links == null) { 
//                 throw new Error('Street View Links not found for this panorama')
//             }
//             //// We then loop through each of the links (i.e., the adjacent panoramas) searching for the link 
//             //// for the panorama that is located in the target area (e.g., if the orientation of the subject panorama 
//             //// is on the left-hand side of a map center point, then our target area would be represented by the area 
//             //// to the right of the subject panorama). Each panorama may have up to four links (this is an assumption) for
//             //// each of the possible directions that one can move from a given panorama (i.e., right, backward, left, forward).
//             let targetLinkFound: boolean = false
//             for (let j=0; j< links.length; j++) {
//                 // Set position (i.e., geocodes) of link 
//                 const link: google.maps.StreetViewLink | undefined = links![j]
//                 if (link == null) {
//                     continue
//                 }
//                 // Get panorama data for the given pano id
//                 const streetViewPanoRequest: google.maps.StreetViewPanoRequest = { pano: link.pano }
//                 const result = await streetViewService.getPanorama(streetViewPanoRequest)
//                 if (result == null) {
//                     continue
//                 }
//                 if (result.data == null) {
//                     continue
//                 }
//                 if (result.data.location == null) {
//                     continue
//                 }
//                 const linkPoint = result.data.location.latLng
//                 if (linkPoint == null) {
//                     continue
//                 }
//                 // Set vector for panorama point and link point
//                 const pLVector: number[] = this.vector(this._mainPanoramaPoint, linkPoint)
//                 // Check whether link point is located in the target area
//                 switch (true) { 
//                     case this._mainPanoramaOrientation == 'LEFTOF':
//                         if (this.isInArea(areaVectors.right, pLVector)) {
//                             this._adjacentPanoramaPoints[i] = linkPoint
//                             count++
//                             targetLinkFound = true
//                         }
//                         break 
//                     case this._mainPanoramaOrientation == 'RIGHTOF':
//                         if (this.isInArea(areaVectors.left, pLVector)) {
//                             this._adjacentPanoramaPoints[i] = linkPoint
//                             count++
//                             targetLinkFound = true 
//                         }
//                         break
//                     case this._mainPanoramaOrientation == 'FRONTOF':
//                         // Check left area for first, then check right area second
//                         if (i < NUMBER_OF_ADJACENT_PANORAMAS/2) {
//                             if (this.isInArea(areaVectors.left, pLVector)) {
//                                 this._adjacentPanoramaPoints[i] = linkPoint
//                                 count++
//                                 targetLinkFound = true
//                             } else {
//                                 break
//                             }
//                         } else {
//                             if (this.isInArea(areaVectors.right, pLVector)) {
//                                 this._adjacentPanoramaPoints[i] = linkPoint
//                                 count++
//                                 targetLinkFound = true
//                             } else {
//                                 break
//                             }
//                         }
//                         break
//                     default:
//                         throw new Error('invalid orientation')
//                 }
//                 if (targetLinkFound) break
//             }
//             // If the main panorama orientation is _LEFTOF_ or _RIGHTOF_, then when no link in 
//             // the target area is found, we should exit the main loop. However, if the main panorama
//             // orientation is _FRONTOF_, then if no link is found going left, we still should
//             // check whether we can find a link going right.
//             if (this._mainPanoramaOrientation !== 'FRONTOF') {
//                 if (!targetLinkFound) break
//             } else if (i < NUMBER_OF_ADJACENT_PANORAMAS/2) {
//                 // Going left, so just continue with the next iteration of the main loop
//                 continue
//             } else {
//                 // Going right, so exit the main loop if no link found
//                 if (!targetLinkFound) break
//             }
//             // Assign the the link point as the active point. If the main panorama orientation is 
//             // _FRONTOF_, then we look for links to the left of the main panorama for half of the 
//             // value assigned to _NUMBER_OF_ADJACENT_PANORAMAS, so once we reach that half way point
//             // we need to assign the active point as the main panorama point. That way, we can look 
//             // for links to the right of the main panorama.
//             const switchPoint = NUMBER_OF_ADJACENT_PANORAMAS/2 - 1
//             if (this._mainPanoramaOrientation == 'FRONTOF' && i == switchPoint) {
//                 activePoint = this._mainPanoramaPoint
//             } else {
//                 activePoint = this._adjacentPanoramaPoints[i]
//             }
//         }
//         return {
//             points: this._adjacentPanoramaPoints,
//             count: count
//         }
//     }
// }
// export { AdjacentStreetViewPanoramas }
//# sourceMappingURL=index.js.map