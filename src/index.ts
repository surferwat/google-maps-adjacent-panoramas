const NUMBER_OF_ADJACENT_PANORAMAS = 2 // must be an even number

enum PanoramaOrientation {
    LeftOf = 'LEFTOF',
    FrontOf = 'FRONTOF',
    RightOf = 'RIGHTOF'
}

type Result = {
    panoramas: google.maps.StreetViewPanorama[],
    count: number
}


class AdjacentStreetViewPanoramas {
    private _mapCenterPoint: google.maps.LatLng
    private _subjectStreetViewPanorama: google.maps.StreetViewPanorama
    private _subjectStreetViewPanoramaOrientation: PanoramaOrientation = PanoramaOrientation.FrontOf // default is _FrontOf_
    private _adjacentStreetViewPanoramas: google.maps.StreetViewPanorama[]

    constructor(
        initMapCenterPoint: google.maps.LatLng, 
        initSubjectStreetViewPanorama: google.maps.StreetViewPanorama, 
        initSubjectStreetViewPanoramaOrientation: PanoramaOrientation,
        initAdjacentStreetViewPanoramas: google.maps.StreetViewPanorama[] 
    ) {
        this._mapCenterPoint = initMapCenterPoint,
        this._subjectStreetViewPanorama = initSubjectStreetViewPanorama,
        this._subjectStreetViewPanoramaOrientation = initSubjectStreetViewPanoramaOrientation,
        this._adjacentStreetViewPanoramas = initAdjacentStreetViewPanoramas
    }

    private heading(heading: number): number {
        let x: number = heading
        if (x > 180) {
            if (x < 0) x = 180 - Math.abs(x)%180
            if (x > 0) x = Math.abs(x)%180 - 180
        }
        return x
    }

    private headings(referenceHeading: number): number[] {
        const startHeading: number = referenceHeading%90 
            ? referenceHeading + 45 
            : referenceHeading
        
        const maxHeadings = 4
        let headings: number[] = []
        for (let i=0; i<maxHeadings; i++) {
            let heading: number
            if (i == 0) {
                heading = startHeading
            } else {
                heading = this.heading(startHeading + (90*i))
            }
            headings.push(heading)
        }
        return headings // [aHeading, bHeading, cHeading, dHeading]
    }

    private points(pPoint: google.maps.LatLng, distance: number, headings: number[]): google.maps.LatLng[] {
        const maxPoints = 4 
        let points: google.maps.LatLng[] = []
        for (let i=0; i<maxPoints; i++) {
            const point: google.maps.LatLng = google.maps.geometry.spherical.computeOffset(pPoint, distance * 2, headings[i])
            points.push(point)
        }
        return points // [aPoint, bPoint, cPoint, dPoint]
    }

    private scalar(startPoint: google.maps.LatLng, endPoint: google.maps.LatLng): number[] {
        return [
            endPoint.lng() - startPoint.lng(), 
            endPoint.lat() - startPoint.lat() 
        ]
    }

    private scalars(startPoint: google.maps.LatLng, endPoints: google.maps.LatLng[]): number[][] {
        let scalars: number[][] = []
        for (let i=0; i<endPoints.length; i++) {
            let scalar: number[] = this.scalar(startPoint, endPoints[i])
            scalars.push(scalar)
        }
        return scalars // [pAVector, pBVector, pCVector, pDVector]
    }

    private scalarProduct(scalar1: number[], scalar2: number[], size: number): number {
        let sp: number = 0
        for (let i = 0; i < size; i++) {
            sp =+ scalar1[i] * scalar2[i]
        }
        return sp
    }

    private isInArea(area: number[][], newScalar: number[]): boolean {
        let locatedInArea: boolean = false 
        if (this.scalarProduct(area[0], newScalar, 2) > 0 && this.scalarProduct(area[1], newScalar, 2) > 0) {
            locatedInArea = true
        }
        return locatedInArea
    }

    /**
     * Updates each Street View Panorama object with the pano ID for a panorama adjacent to the subject panorama. 
     * Adjacent means on the left- and/or right-hand side of the subject panorama depending on the orientation of the subject panorama).
     */

    configureAdjacentPanoramas(): Result {
        let activePanorama: google.maps.StreetViewPanorama = this._subjectStreetViewPanorama
        let count: number = 0 // keep track of number of panoramas configured

        for(let i=0; i<NUMBER_OF_ADJACENT_PANORAMAS; i++) {
            
            const links: (google.maps.StreetViewLink | null)[] | null = activePanorama.getLinks()
            
            if (links == null) { 
                throw new Error('Street View Links not found for this panorama')
            } // non-null assertion used with _links_ below because we know links are not null by this line
            

            const pPoint: google.maps.LatLng | null = activePanorama.getPosition()

            if (pPoint == null) {
                throw new Error('Street View LatLng not found for this panorama')
            }

            //// We need to determine the area that represents the right, back, left, or front area for a given 
            //// point in a 2D plane. We do this by figuring out each pair of scalars that represent the sides
            //// for a given area.

            const distanceBetweenPPointAndOPoint: number = google.maps.geometry.spherical.computeDistanceBetween(pPoint, this._mapCenterPoint)
            const pPointToMapCenterPointHeading: number = google.maps.geometry.spherical.computeHeading(pPoint, this._mapCenterPoint)
            const headings: number[] = this.headings(pPointToMapCenterPointHeading)
            const points: google.maps.LatLng[] = this.points(pPoint, distanceBetweenPPointAndOPoint, headings)
            const scalars: number[][] = this.scalars(pPoint, points)
    
            const areaScalars = {
                right: [scalars[0], scalars[1]],
                back: [scalars[1], scalars[2]],
                left: [scalars[2], scalars[3]],
                front: [scalars[3], scalars[0]]
            }
            
            //// We then loop through each of the links (i.e., the adjacent panoramas) searching for the link 
            //// for the panorama that is located in the target area (e.g., if the orientation of the subject panorama 
            //// is on the left-hand side of a map center point, then our target area would be represented by the area 
            //// to the right of the subject panorama). Each panorama may have up to four links (this is an assumption) for
            //// each of the possible directions that one can move from a given panorama (i.e., right, backward, left, forward).

            let panoramaConfigured: boolean = false
            for (let j=0; j<links.length; j++) {
                
                function setLinkPointCallBack(
                    data: google.maps.StreetViewPanoramaData | null, 
                    status: google.maps.StreetViewStatus
                ): void {
                    if (status === 'OK') {
                        const location = data ? data.location : null
                        linkPoint = location ? location.latLng : null
                    } else {
                        console.warn('Street View data not found for this location; moving to next iteration, if any')
                    }
                }
    
                function setAdjacentPanoramaCallBack(
                    data: google.maps.StreetViewPanoramaData | null, 
                    status: google.maps.StreetViewStatus,
                ): void {
                    if (status === 'OK') {
                        const link: google.maps.StreetViewLink | null = links![j]
                        const pano: string | null = link != null ? link.pano : null
                        if (pano != null) this._adjacentStreetViewPanoramas[i].setPano(pano)
                        panoramaConfigured = true
                        count++
                    } else {
                        console.warn('Street View data not found for this location; panorama in this iteration has not been updated')
                    }
                }
    
                // Set position (i.e., geocodes) of link 
                let linkPoint: google.maps.LatLng | null | undefined
                if (linkPoint == null) continue  // check if null or undefined
                const streetViewService = new google.maps.StreetViewService()
                const link: google.maps.StreetViewLink | null = links![j]
                const streetViewPanoRequest: google.maps.StreetViewPanoRequest | null = link != null ? link.pano as google.maps.StreetViewPanoRequest : null
                if (streetViewPanoRequest != null) streetViewService.getPanorama(streetViewPanoRequest, setLinkPointCallBack)
    
                // Set vector for panorama point and link point
                const pLVector: number[] = this.scalar(pPoint, linkPoint)
                
                // Check whether link point is located in the target area
                let targetLinkFound: boolean = false
                switch (true) { 
                    case this._subjectStreetViewPanoramaOrientation == 'LEFTOF':
                        if (this.isInArea(areaScalars.right, pLVector)) {
                            const link: google.maps.StreetViewLink | null = links![j]
                            const streetViewPanoRequest: google.maps.StreetViewPanoRequest | null = link != null ? link.pano as google.maps.StreetViewPanoRequest : null
                            if (streetViewPanoRequest != null) streetViewService.getPanorama(streetViewPanoRequest, setAdjacentPanoramaCallBack)
                            targetLinkFound = true
                        }
                        break 
                    case this._subjectStreetViewPanoramaOrientation == 'RIGHTOF':
                        if (this.isInArea(areaScalars.left, pLVector)) {
                            const link: google.maps.StreetViewLink | null = links![j]
                            const streetViewPanoRequest: google.maps.StreetViewPanoRequest | null = link != null ? link.pano as google.maps.StreetViewPanoRequest : null
                            if (streetViewPanoRequest != null) streetViewService.getPanorama(streetViewPanoRequest, setAdjacentPanoramaCallBack)
                            targetLinkFound = true 
                        }
                        break
                    case this._subjectStreetViewPanoramaOrientation == 'FRONTOF':
                        // Check left area for first, then check right area second
                        if (j < NUMBER_OF_ADJACENT_PANORAMAS/2) {
                            if (this.isInArea(areaScalars.left, pLVector)) {
                                const link: google.maps.StreetViewLink | null = links![j]
                                const streetViewPanoRequest: google.maps.StreetViewPanoRequest | null = link != null ? link.pano as google.maps.StreetViewPanoRequest : null
                                if (streetViewPanoRequest != null) streetViewService.getPanorama(streetViewPanoRequest, setAdjacentPanoramaCallBack)
                                targetLinkFound = true
                            } else {
                                break
                            }
                        } else {
                            if (this.isInArea(areaScalars.right, pLVector)) {
                                const link: google.maps.StreetViewLink | null = links![j]
                                const streetViewPanoRequest: google.maps.StreetViewPanoRequest | null = link != null ? link.pano as google.maps.StreetViewPanoRequest : null
                                if (streetViewPanoRequest != null) streetViewService.getPanorama(streetViewPanoRequest, setAdjacentPanoramaCallBack)
                                targetLinkFound = true
                            } else {
                                break
                            }
                        }
                        break
                    default:
                        throw new Error('invalid orientation')
                }

                if (targetLinkFound) break
            }

            if (!panoramaConfigured) break 
            activePanorama = this._adjacentStreetViewPanoramas[i]
        }

        return {
            panoramas: this._adjacentStreetViewPanoramas,
            count: count
        }
    }
}


export { AdjacentStreetViewPanoramas }