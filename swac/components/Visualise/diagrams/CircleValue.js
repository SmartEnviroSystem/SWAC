import SWAC from '../../../swac.js';
import Msg from '../../../Msg.js';

/**
 * CircleValue - A simple diagram that displays a value centered inside a colored circle.
 * The circle's background color is determined by the legend/definition range the value falls into.
 */
export default class CircleValue extends Diagram {
    constructor(unit, name, width, height, datadescription, diagramDef, comp) {
        super(unit, name, width, height, datadescription, diagramDef, comp);
    }

    /**
     * Draws a filled circle whose background color matches the legend range
     * of the given value. The value (rounded to 2 decimal places) is displayed
     * centered inside the circle.
     *
     * @param {String} name Diagram label
     * @param {Object} value The value to display
     * @returns {Element} SVG element containing the diagram
     */
    drawValueDiagram(name, value) {
        if (!this.datadescription) {
            Msg.error('CircleValue', 'There is no datadescription defined.');
            return;
        }

        // Retrieve the definitions (legend entries with color and value ranges)
        let definitions = this.datadescription.getDefinitions(this.diagramDef.attr);
        if (!definitions) {
            Msg.error('CircleValue', 'There are no definitions for >' + this.diagramDef.attr + '< in the datadescription.');
            return document.createElement('span');
        }

        // Find the background color based on which definition range the value falls into
        let bgColor = 'rgb(202, 202, 202)'; // default fallback color if no range matches
        for (let curDef of definitions) {
            if (value >= curDef.minValue && value <= curDef.maxValue) {
                bgColor = curDef.col;
                break;
            }
        }

        // Create the SVG viewport
        let svgViewBox = document.createElementNS("http://www.w3.org/2000/svg", "svg");
        svgViewBox.setAttribute("viewBox", "0 0 400 400");
        svgViewBox.setAttribute("width", this.width);
        svgViewBox.setAttribute("height", this.height);

        // Draw the filled circle with the legend-matched background color
        let svgCircle = document.createElementNS("http://www.w3.org/2000/svg", "circle");
        svgCircle.setAttribute("style", "fill: " + bgColor + ";");
        svgCircle.setAttribute("cx", "200");
        svgCircle.setAttribute("cy", "200");
        svgCircle.setAttribute("r", "200");
        svgViewBox.appendChild(svgCircle);

        // Display the value rounded to 2 decimal places, centered inside the circle
        let svgValue = document.createElementNS("http://www.w3.org/2000/svg", "text");
        svgValue.setAttribute("fill", "black");
        svgValue.setAttribute("x", "200");
        svgValue.setAttribute("y", "200");
        svgValue.setAttribute("text-anchor", "middle");
        svgValue.setAttribute("dominant-baseline", "middle");
        svgValue.setAttribute("font-size", "80");
        svgValue.setAttribute("font-weight", "bold");
        svgValue.innerHTML = this.roundMax2(value);
        svgViewBox.appendChild(svgValue);

        return svgViewBox;
    }

    /**
     * Dataset diagrams are not supported for CircleValue.
     *
     * @param {Object} set The dataset
     */
    drawSetDiagram(set) {
        Msg.error('CircleValue', 'CircleValue does not support visualising datasets.');
    }

    /**
     * Rounds a number to a maximum of 2 decimal places.
     *
     * @param {number} num The number to round
     * @returns {number} Rounded number
     */
    roundMax2(num) {
        return Math.round((num + Number.EPSILON) * 100) / 100;
    }
}