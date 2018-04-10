
String.prototype.uppercaseFirstLetter = function () {
    return this.charAt(0).toUpperCase() + this.slice(1);
}

String.prototype.lowercaseFirstLetter = function () {
    return this.charAt(0).toLowerCase() + this.slice(1);
}

function jsonKeyToPropertyName(key) {
    var name = key.split(/-|_|:/).map(function (str) { return str.uppercaseFirstLetter() }).join("").lowercaseFirstLetter();
    return name;
}

function saveResult() {
    const topLevelType = $('#topLevelTypeTextField').val();
    var blob = new Blob([$('#resultDiv').text()], {type: "text/plain;charset=utf-8"});
    saveAs(blob, topLevelType + ".swift");
}

function generateCodable() {
	
	var protocolConformance = "Codable";
	if ($('#conformToDecodable').is(':checked')) {
		protocolConformance = "Decodable";
	} else if ($('#conformToEncodable').is(':checked')) {
		protocolConformance = "Encodable";
	}

    const copyrightHeader = $('#copyrightTextField').val().replace("{year}", (new Date()).getFullYear());
    const topLevelType = $('#topLevelTypeTextField').val();
    
    var json = null;
    try {
        json = JSON.parse($('#jsonTextArea').val());
    } catch(e) {
        $('#resultDiv').text(e);
        return;
    }
    
    console.log(json);
    
    const topLevelProperties = createObject(json);
        
    console.log(topLevelProperties);
    
    const codableExtensions = generateCodableExtensions(topLevelType, topLevelProperties, protocolConformance);
    
    const members = generateMembers(topLevelProperties, 0)
    
    var output = `
//
//  ${copyrightHeader}
//

import Foundation

public struct ${topLevelType} {${members}
}

// ---------------------------------------------------------------------------
// MARK: - Codable
// ---------------------------------------------------------------------------
${codableExtensions}
`.trim();
    
    $('#resultDiv').text(output);
    
    $('#resultDiv').each(function(i, block) {
        hljs.highlightBlock(block);
    });
}

function generateMembers(properties, indentLevel) {
    if (properties == null) {
        return "";
    }
    
    var nestedTypes = "\n";
    var members = "";
    
    for (var propertyIndex in properties) {
        var property = properties[propertyIndex];
        if (["Bool", "Int", "Double", "String"].includes(property.type)) {
            continue;
        } else if (property.type == "[]") {
            if (["Bool", "Int", "Double", "String", "Any"].includes(property.subtype)) {
                continue;
            } else if (property.subtype.charAt(0) == "[") {
                continue;
            } else {
                var nestedType = "\n" + indent(indentLevel + 1) + `public struct ${property.subtype} {`;
                nestedType += `${generateMembers(property.properties, indentLevel + 1)}\n`
                nestedType += indent(indentLevel + 1) + `}`;
                nestedTypes += nestedType + "\n";                
            }
        } else {
            var nestedType = "\n" + indent(indentLevel + 1) + `public struct ${property.type} {`;
            nestedType += `${generateMembers(property.properties, indentLevel + 1)}\n`
            nestedType += indent(indentLevel + 1) + `}`;
            nestedTypes += nestedType + "\n";
        }
    }
    
    for (var propertyIndex in properties) {
        var property = properties[propertyIndex];
        var member = "";
        
        if (["Bool", "Int", "Double", "String"].includes(property.type)) {
            member += indent(indentLevel + 1) + `public let ${property.name}: ${property.type}`;
            member += property.optional ? "?" : "";
        } else if (property.type == "[]") {
            member += indent(indentLevel + 1) + `public let ${property.name}: [${property.subtype}]`;
            member += property.optional ? "?" : "";
        } else {
            member += indent(indentLevel + 1) + `public let ${property.name}: ${property.type}`;
            member += property.optional ? "?" : "";
        }
        
        members += member + "\n";
    }
    
    if (nestedTypes == "\n") {
        nestedTypes = "";
    }
    return nestedTypes + "\n" + indent(indentLevel + 1) + members.trim();
    
    return members.trim();
}

function generateCodableExtensions(topLevelType, topLevelProperties, protocolConformance) {
    var extensions = "";
    return generateCodableExtension(topLevelType, topLevelProperties, extensions, null, protocolConformance);
}

function generateCodableExtension(type, properties, extensions, comment, protocolConformance) {
        
    var codingKeys = generateCodingKeys(properties);
    var initializers = generateInitializers(properties);
	var encoders = generateEncoders(properties);
    
	var commentString = '';
	if (comment != null) {
		commentString += '\n// ' + comment + "";
	}
	
    var output = `${commentString}        
extension ${type}: ${protocolConformance} {
        
    enum CodingKeys: String, CodingKey {
        ${codingKeys}
    }
`;

	if (protocolConformance == "Codable" || protocolConformance == "Decodable") {
		output += `    
    public init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        ${initializers}
    }
`;		
	} 
	
	if (protocolConformance == "Codable" || protocolConformance == "Encodable") {
		output += `
    public func encode(to encoder: Encoder) throws {
        var container = encoder.container(keyedBy: CodingKeys.self)
        ${encoders}
    }
`;
	}

	output += '}\n';
	
    extensions += output;
    
    for (var propertyIndex in properties) {
        var property = properties[propertyIndex];
        
        if (["Bool", "Int", "Double", "String"].includes(property.type)) {
            continue;
        } else if (property.type == "[]") {
            if (["Bool", "Int", "Double", "String"].includes(property.subtype)) {
                continue;
            }
            extensions = generateCodableExtension(type + "." + property.subtype, property.properties, extensions, property.comment, protocolConformance);
            continue;
        } else {
            extensions = generateCodableExtension(type + "." + property.type, property.properties, extensions, property.comment, protocolConformance);
        }
    }
    
    return extensions;
}

function generateCodingKeys(properties) {
	
	if (properties.length == 0) {
		return (indent(2) + "// This object does not have properties.\n" + indent(2) + "// Add property coding keys here, once it does.\n").trim()
	}
	
    var codingKeys = "";
    for (var propertyIndex in properties) {
        var property = properties[propertyIndex];
        if (property.name == property.key) {
            codingKeys += indent(2) + `case ${property.name}\n`;
        } else {
            codingKeys += indent(2) + `case ${property.name} = "${property.key}"\n`;
        }
    }
    return codingKeys.trim();
}

function generateInitializers(properties) {
	
	if (properties.length == 0) {
		return (indent(2) + "// This object does not have properties.\n" + indent(2) + "// Add property initializers here, once it does.\n").trim()
	}
	
    var initializers = "";
    for (var propertyIndex in properties) {
        var property = properties[propertyIndex];
        var initializer = "";
        
        if (["Bool", "Int", "Double", "String"].includes(property.type)) {
            if (!property.optional) {
                initializer += indent(2) + `${property.name} = try container.decode(${property.type}.self, forKey: .${property.name})`;
            } else {
                initializer += indent(2) + `${property.name} = try container.decodeIfPresent(${property.type}.self, forKey: .${property.name})`;
            }
        } else if (property.type == "[]") {
            initializer += indent(2) + `${property.name} = try container.decodeIfPresent([${property.subtype}].self, forKey: .${property.name}) ?? []`;
        } else {
            if (!property.optional) {
                initializer += indent(2) + `${property.name} = try container.decode(${property.type}.self, forKey: .${property.name})`;
            } else {
                initializer += indent(2) + `${property.name} = try container.decodeIfPresent(${property.type}.self, forKey: .${property.name})`;
            }            
        }
        
        initializers += initializer + "\n";
    }
    return initializers.trim();
}

function generateEncoders(properties) {
    var encoders = "";
    for (var propertyIndex in properties) {
        var property = properties[propertyIndex];
        var encoder = "";
        
		if (!property.optional) {
			encoder += indent(2) + `try container.encode(${property.name}, forKey: .${property.name})`;
		} else {
			encoder += indent(2) + `try container.encodeIfPresent(${property.name}, forKey: .${property.name})`;
		}
        
        encoders += encoder + "\n";
    }
    return encoders.trim();
}

function indent(levels) {
    var output = "";
    for (var i = 0; i < levels; i++) {
        output += "    ";
    }
    return output;
}

function createObject(json) {
    
    var properties = [];

    for (var jsonKey in json) {
        const value = json[jsonKey];
        const key = jsonKeyToPropertyName(jsonKey);
        var property = null;
        switch (typeof value) {
            case 'boolean':
                property = {
                    name: key,
                    key: jsonKey,
                    type: "Bool",
                    optional: true,
                    properties: null,
					comment: null
                };
                properties.push(property);
                break;

            case 'string':
                property = {
                    name: key,
                    key: jsonKey,
                    type: "String",
                    optional: true,
                    properties: null,
					comment: null
                };
                properties.push(property);
                break;
            
            case 'number':
                if (Math.round(value) == value) {
                    property = {
                        name: key,
                        key: jsonKey,
                        type: "Int",
                        optional: true,
                        properties: null,
						comment: null
                    };
                    properties.push(property);
                } else {
                    property = {
                        name: key,
                        key: jsonKey,
                        type: "Double",
                        optional: true,
                        properties: null,
						comment: null
                    };
                    properties.push(property);
                }
                break;
            
            case 'object':
                // If null, the Swift type is Any.
                if (value == null) {
                    property = {
                        name: key,
                        key: jsonKey,
                        type: "Any",
                        optional: true,
                        properties: null,
						comment: "This was a null in the JSON"
                    };
                    properties.push(property);
                } else if (Array.isArray(value)) {
                    if (value.length == 0) {
                        property = {
                            name: key,
                            key: jsonKey,
                            type: "[]",
                            subtype: key.uppercaseFirstLetter() + "Element",
                            optional: false,
                            properties: [],
							comment: "This element is from an empty array and thus has no properties."
                        };
                        properties.push(property);
                    } else {
                        var subtype = "";
                        var element = value[0];
                        switch (typeof element) {
                            case 'boolean':
                                subtype = "Bool";
                                subproperties = null;
                                break;
                            case 'string':
                                subtype = "String";
                                subproperties = null;
                                break;
                            case 'number':
                                if (Math.round(element) == element) {
                                    subtype = "Int";
                                } else {
                                    subtype = "Double";
                                }
                                subproperties = null;
                                break;
                            case 'object':
                                // If null, the Swift type is Any.
                                if (element == null) {
                                } else if (Array.isArray(element)) {
                                    subtype = "[Nested arrays are not supported yet.]";
                                    subproperties = null;
                                } else {
                                    subtype = key.uppercaseFirstLetter() + "Element"
                                    subproperties = createObject(element);
                                }
                                break;
                        }
                        property = {
                            name: key,
                            key: jsonKey,
                            type: "[]",
                            subtype: subtype,
                            optional: false,
                            properties: subproperties,
							comment: null
                        };
                        properties.push(property);
                    }
                } else {
                    property = {
                        name: key,
                        key: jsonKey,
                        type: key.uppercaseFirstLetter(),
                        optional: true,
                        properties: createObject(value),
						comment: null
                    };
                    properties.push(property);
                }
                break;
        }
    }

    return properties;
}

