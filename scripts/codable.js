
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

    const copyrightHeader = $('#copyrightTextField').val();
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
    
    const codableExtensions = generateCodableExtensions(topLevelType, topLevelProperties);
    
    const members = generateMembers(topLevelProperties, 0)
    
    var output = `
//
//  ${copyrightHeader}
//

import Foundation

public struct ${topLevelType}: Codable {${members}
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
            if (["Bool", "Int", "Double", "String"].includes(property.subtype)) {
                continue;
            } else if (property.subtype.charAt(0) == "[") {
                continue;
            } else {
                var nestedType = "\n" + indent(indentLevel + 1) + `public struct ${property.subtype}: Codable {`;
                nestedType += `${generateMembers(property.properties, indentLevel + 1)}\n`
                nestedType += indent(indentLevel + 1) + `}`;
                nestedTypes += nestedType + "\n";                
            }
        } else {
            var nestedType = "\n" + indent(indentLevel + 1) + `public struct ${property.type}: Codable {`;
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

function generateCodableExtensions(topLevelType, topLevelProperties) {
    var extensions = "";
    return generateCodableExtension(topLevelType, topLevelProperties, extensions);
}

function generateCodableExtension(type, properties, extensions) {
        
    var codingKeys = generateCodingKeys(properties);
    var initializers = generateInitializers(properties);
    
    var output = `        
extension ${type} {
        
    enum CodingKeys: String, CodingKey {
        ${codingKeys}
    }
        
    public init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        ${initializers}
    }
}
`;
    extensions += output;
    
    for (var propertyIndex in properties) {
        var property = properties[propertyIndex];
        
        if (["Bool", "Int", "Double", "String"].includes(property.type)) {
            continue;
        } else if (property.type == "[]") {
            if (["Bool", "Int", "Double", "String"].includes(property.subtype)) {
                continue;
            }
            extensions = generateCodableExtension(type + "." + property.subtype, property.properties, extensions);
            continue;
        } else {
            extensions = generateCodableExtension(type + "." + property.type, property.properties, extensions);
        }
    }
    
    return extensions;
}

function generateCodingKeys(properties) {
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
                    properties: null
                };
                properties.push(property);
                break;

            case 'string':
                property = {
                    name: key,
                    key: jsonKey,
                    type: "String",
                    optional: true,
                    properties: null
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
                        properties: null
                    };
                    properties.push(property);
                } else {
                    property = {
                        name: key,
                        key: jsonKey,
                        type: "Double",
                        optional: true,
                        properties: null
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
                        properties: null
                    };
                    properties.push(property);
                } else if (Array.isArray(value)) {
                    if (value.count == 0) {
                        property = {
                            name: key,
                            key: jsonKey,
                            type: "[]",
                            subtype: "Any",
                            optional: true,
                            properties: []
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
                            properties: subproperties
                        };
                        properties.push(property);
                    }
                } else {
                    property = {
                        name: key,
                        key: jsonKey,
                        type: key.uppercaseFirstLetter(),
                        optional: true,
                        properties: createObject(value)
                    };
                    properties.push(property);
                }
                break;
        }
    }

    return properties;
}

