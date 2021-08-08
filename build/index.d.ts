/// <reference types="google.maps" />
declare enum PanoramaOrientation {
    LeftOf = "LEFTOF",
    FrontOf = "FRONTOF",
    RightOf = "RIGHTOF"
}
declare type AdjacentPanoramaLocations = {
    panosAndPoints: {
        pano: string;
        point: google.maps.LatLng;
    }[];
    count: number;
};
declare class AdjacentStreetViewPanoramaLocations {
    private _mapCenterPoint;
    private _mainPanoramaPoint;
    private _mainPanoramaOrientation;
    private _adjacentPanoramaPanosAndPoints;
    constructor(initMapCenterPoint: google.maps.LatLng, initMainPanoramaPoint: google.maps.LatLng, initMainPanoramaOrientation: PanoramaOrientation);
    private heading;
    private headings;
    private points;
    private vector;
    private vectors;
    private dotProduct;
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
    private isInArea;
    /**
     * Retrieves the _google.maps.LatLng_ for panoramas adjacent to the main panorama.
     * Adjacent means on the left- and/or right-hand side of the main panorama depending on the orientation of the main panorama).
     */
    getLocations(): Promise<AdjacentPanoramaLocations>;
}
export { AdjacentStreetViewPanoramaLocations };
