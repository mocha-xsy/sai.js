/*
 * HTML Parser By John Resig (ejohn.org)
 * Original code by Erik Arvidsson, Mozilla Public License
 * http://erik.eae.net/simplehtmlparser/simplehtmlparser.js
 *
 * // Use like so:
 * HTMLParser(htmlString, {
 *     doctype: function(tag, xml, version, type){},
 *     start: function(tag, attrs, unary) {},
 *     end: function(tag) {},
 *     chars: function(text) {},
 *     comment: function(text) {}
 * });
 *
 * // or to get an XML string:
 * HTMLtoXML(htmlString);
 *
 * // or to get an XML DOM Document
 * HTMLtoDOM(htmlString);
 *
 * // or to inject into an existing document/DOM node
 * HTMLtoDOM(htmlString, document);
 * HTMLtoDOM(htmlString, document.body);
 *
 * TODO: innerHTML
 *       stack[<Node>]
 *       return {
 *          error:error,
 *          dom:dom
 *       }
 *
 */

(function(){
    // URI, URL, Links, Location...
    var URI = {
        // 获得Archor对象，便于获取其protocol,host...属性。
        // 可惜IE直接复制相对地址无法获得正确的属性，需要设置绝对地址。
        // @param {String"} uri 绝对/相对地址。
        // @usage URI.parse(img.src); //! img.getAttribute("src");
        //        URI.parse(cssLink.href);
        //        URI.parse(script.src);
        reFolderExt:/[^\/]*$/,
        reProtocol:/^\w+:/,
        parse: function(uri){
            if(undefined === uri || typeof(uri)!="string"){
                throw new TypeError("required string argument.");
            }
            var host = location.protocol + "\/\/" + location.hostname,
                base = host + location.pathname.replace(URI.reFolderExt, uri);
            var a = document.createElement("a");
            if(!URI.reProtocol.test(uri)){
                if(uri.indexOf("/")==0){
                    uri = location.protocol + "\/\/" + location.hostname + uri;
                    //uri = host + uri;
                }else{
                    uri = location.protocol + "\/\/" + location.hostname +
                        location.pathname.replace(URI.reProtocol, uri);
                }
            }
            a.setAttribute("href", uri);
            return a;
        }
    };
    // HTML Node Object.
    var Node = function(){
        this.tagName = null;
        this.start = null;
        this.end = null;
        this.attrs = {};
        this.selfClose = false;
        this.startLine = 0;
        this.endLine = 0;
        this.childNodes = [];
        this.parentNode = null;
    };
    Node.prototype.hasAttribute = function(name){
        return this.attrs.hasOwnProperty(name);
    };
    Node.prototype.setAttribute = function(name, value){
        this.attrs[name] = value;
    };
    Node.prototype.getAttribute = function(name){
        return this.hasAttribute(name) ? this.attrs[name] : null;
    };
    Node.prototype.removeAttribute = function(name){
        this.attrs[name] = null;
        delete this.attrs[name];
    };
    Node.prototype.attributes = function(){
        var a = [];
        for(var k in this.attrs){
            if(this.attrs.hasOwnProperty(k)){
                a.push(k);
            }
        }
        return a;
    };
    Node.prototype.appendChild = function(node){
        if(!(node instanceof Node)){throw new TypeError("required Node object.");}
        node.parentNode = this;
        this.childNodes.push(node);
    };
    // TODO: innerHTML
    Node.prototype.innerHTML = function(){};
    Node.prototype.getElementsByTagName = function(tagName){
        tagName = tagName.toLowerCase();
        var a = [];
        for(var i=0,l=this.childNodes.length; i<l; i++){
            if((this.childNodes[i].tagName && this.childNodes[i].tagName.toLowerCase() == tagName) ||
              tagName == "*"){
                a.push(this.childNodes[i]);
            }
            // a = a.concat(this.childNodes[i].getElementsByTagName(tagName));
            Array.prototype.push.apply(a, this.childNodes[i].getElementsByTagName(tagName));
        }
        return a;
    };
    var htmlErrors = [];
    function log(type, line, msg, err){
        //htmlErrors.push({ln:line, err:err, code:msg});
        htmlErrors.push({line:line, code:err, message:msg, source:msg});
        if(window.console && window.console.log){window.console.log(line, err, msg);}
        //var msg=Array.prototype.join.call(arguments);
        //if(window.console && window.console.log){window.console.log(msg);}
        //else{throw new Error(msg);}
    }

	// Regular Expressions for parsing tags and attributes
	var startTag = /^<(\w+)((?:\s+[\w:-]+(?:\s*=\s*(?:(?:"[^"]*")|(?:'[^']*')|[^>\s]+))?)*)\s*(\/?)>/,
		endTag = /^<\/(\w+)[^>]*>/,
		attr = /([\w:-]+)(?:\s*=\s*((?:"((?:\\.|[^"])*)")|(?:'((?:\\.|[^'])*)')|([^>\s]+)))?/g,
        reDoctype = /^<!doctype\s[^>]+>/i,
        reDoctypeSniffing = /^<!DOCTYPE\s+HTML\sPUBLIC\s+"\-\/\/W3C\/\/DTD\s+(X?HTML)\s+([\d.])+(?:\s+(\w+))?\/\/EN"\s+"[^"]+">/i,
        reDoctypeHTML5 = /^<!DOCTYPE\s+HTML>/i,
        newLine = /\r\n|\r|\n/;

	// Empty Elements - HTML 4.01
	var empty = makeMap("area,base,basefont,br,col,frame,hr,img,input,isindex,link,meta,param,embed");

	// Block Elements - HTML 4.01
	var block = makeMap("address,applet,blockquote,button,center,dd,del,dir,div,dl,dt,fieldset,form,frameset,hr,iframe,ins,isindex,li,map,menu,noframes,noscript,object,ol,p,pre,script,table,tbody,td,tfoot,th,thead,tr,ul");

	// Inline Elements - HTML 4.01
	var inline = makeMap("a,abbr,acronym,applet,b,basefont,bdo,big,br,button,cite,code,del,dfn,em,font,i,iframe,img,input,ins,kbd,label,map,object,q,s,samp,script,select,small,span,strike,strong,sub,sup,textarea,tt,u,var");

	// Elements that you can, intentionally, leave open
	// (and which close themselves)
	var closeSelf = makeMap("colgroup,dd,dt,li,option,p,td,tfoot,th,thead,tr");

	// Attributes that have their values filled in disabled="disabled"
	var fillAttrs = makeMap("checked,compact,declare,defer,disabled,ismap,multiple,nohref,noresize,noshade,nowrap,readonly,selected");

	// Special Elements (can contain anything)
    var sp = "script,style,textarea,xmp";
	var special = makeMap(sp);
    var regexp_special = makeRegExp(sp);
    function makeRegExp(tags){
        var re = {};
        tags = tags.split(",");
        for(var i=0,l=tags.length; i<l; i++){
            re[tags[i]] = new RegExp("(.*)?<\/" + tags[i] + "[^>]*>", "i");
        }
        return re;
    }

    var S = {
        startsWith: function(str, ch){
            return str.indexOf(ch) == 0;
        },
        endsWith: function(str, ch){
            return str.lastIndexOf(ch) == (str.length-ch.length);
        }
    };

	var HTMLParser = this.HTMLParser = function( html, handler ) {
        // stack = [{line:1, tag:"<div id=\"demo\">", tagName:"div"}]
		var index, match, stack = [], last = html;
		stack.last = function(){
			return this[ this.length - 1 ];
		};
        var error=[], line=1;
        var errorCodes = {
            tagsNestedIllegal: 0,
            attrMissingQuote: 1
        };
        var lines = [""].concat(html.replace(/\r\n|\r|\n/g, "\n").split("\n"));
        var dom = new Node();
        var currNode = dom;

		while ( html ) {

			// Make sure we're not in a script or style element
			if ( !stack.last() || !special[ stack.last().tagName ] ) {

                if(reDoctype.test(html)){
                    match = html.match(reDoctype);
                    html = html.substring(match[0].length);
                    if(reDoctypeHTML5.test(match[0])){
                        parseDoctype(match[0], "HTML", 5, "");
                    }else if(reDoctypeSniffing.test(match[0])){
                        match[0].replace(reDoctypeSniffing, parseDoctype);
                    }

                    node = new Node();
                    node.start = match[0];
                    node.startLine = line;
                    currNode.appendChild(node);

                    line += getLine(match[0]);
                    node.endLine = line;
				// Comment
				}else if ( html.indexOf("<!--") == 0 ) {
					index = html.indexOf("-->");

					if ( index >= 4 ) {
						if ( handler.comment )
							handler.comment( html.substring( 4, index ) );

                        node = new Node();
                        node.start = html.substring(0, index);
                        node.startLine = line;
                        currNode.appendChild(node);

                        line += getLine(html.substring(0, index));
                        node.endLine = line;
						html = html.substring( index + 3 );
                    }else{
                        error.push({
                            line: line,
                            message: "comment is not closed.",
                            source: lines[line],
                            code: errorCodes.tagsNestedIllegal
                        });
                        index = html.indexOf("\n");
                        html = html.substring(index);
                    }

				// end tag
				} else if ( html.indexOf("</") == 0 ) {
					match = html.match( endTag );

					if ( match ) {
						html = html.substring( match[0].length );
						match[0].replace( endTag, parseEndTag );
                        line += getLine(match[0]);
                    }else{
                        error.push({
                            line: line,
                            message: "tag "+stack.last().tagName+" closed.",
                            source: lines[line],
                            code: errorCodes.tagsNestedIllegal
                        });
                        index = html.indexOf("<");
                        line += getLine(html.substring(0, index));
                        html = html.substring(index);
                    }

				// start tag
				} else if ( html.indexOf("<") == 0 ) {
					match = html.match( startTag );

					if ( match ) {
						html = html.substring( match[0].length );
						match[0].replace( startTag, parseStartTag );
                        line += getLine(match[0]);
                    }else{
                        error.push({
                            line: line,
                            message: "tag is unclosed.",
                            source: lines[line],
                            code: errorCodes.tagsNestedIllegal
                        });
                        index = html.indexOf("<", 1);
                        if(index > -1){
                            line += getLine(html.substring(0, index));
                            html = html.substring(index);
                        }else{
                            // Clean up any remaining tags
                            parseEndTag();
                            return {
                                error: error,
                                dom: dom
                            };
                        }
                    }
				}else{
					index = html.indexOf("<");

					var text = index < 0 ? html : html.substring( 0, index );
					html = index < 0 ? "" : html.substring( index );

					if ( handler.chars )
						handler.chars( text );

                    line += getLine(text);
                    if(index < 0){
                        // Clean up any remaining tags
                        parseEndTag();
                        return {
                            error: error,
                            dom: dom
                        };
                    }
				}

			} else {
				html = html.replace(regexp_special[stack.last().tagName], function(all, text){
					text = text.replace(/<!--(.*?)-->/g, "$1")
						.replace(/<!\[CDATA\[(.*?)]]>/g, "$1");

					if ( handler.chars )
						handler.chars( text );

                    currNode.innerHTML = text;
					return "";
				});

				parseEndTag( "", stack.last().tagName );
			}

            if ( html == last ){
                error.push({
                    line: line,
                    message: "Parse Error.",
                    source: html,
                    //source: lines[line],
                    code: errorCodes.tagsNestedIllegal
                });

                return {
                    error: error,
                    dom: dom
                };
            }
			last = html;
		}

		// Clean up any remaining tags
		parseEndTag();

        return {
            error: error,
            dom: dom
        };

        function getLine(str){
            var m = str.match(/\r\n|\r|\n/g);
            return m ? m.length : 0;
        }
        // doctype sniffing.
        function parseDoctype(tag, xml, ver, type){
            if(handler.doctype){
                handler.doctype(tag, xml+" "+ver+" "+type);
            }
        }


        /**
         * @param tag, like <div id="demo" onclick="alert(0);">
         * @param tagName, like div.
         * @param rest, attrs like id="demo" onclick="alert(0);"
         * @param unary, / if self close tags like <p />
         */
		function parseStartTag( tag, tagName, rest, unary ) {
            var node = new Node();
            node.tagStart = tag;
            node.startLine = line;
            node.tagName = tagName;
            currNode.appendChild(node);

			if ( block[ tagName ] ) {
				while ( stack.last() && inline[ stack.last().tagName ] ) {
					parseEndTag( "", stack.last().tagName );
				}
			}

			if ( closeSelf[ tagName ] && stack.last().tagName == tagName ) {
				parseEndTag( "", tagName );
			}

			unary = empty[ tagName ] || !!unary;

            if ( !unary ){
				stack.push({"line": line, "tagName": tagName, "tag": tag});
                currNode = node;
            }

            var attrs = [];

            rest.replace(attr, function(match, name) {
                if(!(S.startsWith(arguments[2], '"') && S.endsWith(arguments[2], '"')) &&
                  !(S.startsWith(arguments[2], "'") && S.endsWith(arguments[2], "'"))){
                    error.push({
                        line:line,
                        source: lines[line],
                        message: "attributes missing quotes.",
                        code: errorCodes.attrMissingQuote
                    });
                }
                var value = arguments[3] ? arguments[3] :
                    arguments[4] ? arguments[4] :
                    arguments[5] ? arguments[5] :
                    fillAttrs[name] ? name : "";

                attrs.push({
                    name: name,
                    value: value,
                    escaped: value.replace(/(^|[^\\])"/g, '$1\\\"') //"
                });
                node.setAttribute(name, value);
            });

            if ( handler.start )
                handler.start( tagName, attrs, unary );
		}

        /**
         * @param {String} tag, like </p>, optional.
         * @param {String} tagName, like p.
         */
		function parseEndTag( tag, tagName ) {
			// If no tag name is provided, clean shop
            if ( !tagName ){
				var pos = 0;
            }else{
            // Find the closest opened tag of the same type
                for ( var pos = stack.length - 1; pos >= 0; pos-- ){
                    if ( stack[pos].tagName == tagName ){
						break;
                    }else{
                        error.push({
                            line: stack[pos].line,
                            message: "tag "+stack[pos].tagName+" unclosed.",
                            source: lines[stack[pos].line],
                            //source: stack[pos].tag,
                            code: errorCodes.tagsNestedIllegal
                        })
                    }
                }
            }

			if ( pos >= 0 ) {
				// Close all the open elements, up the stack
                for ( var i = stack.length - 1; i >= pos; i-- ){
                    if(0 == pos){
                        error.push({
                            line: line,
                            message: "tag "+stack[i].tagName+" unclosed.",
                            source: lines[stack[i].line],
                            //source: stack[i].tag,
                            code: errorCodes.tagsNestedIllegal
                        });

                        currNode.end = tag;
                        currNode.endLine = line;
                        currNode  = currNode.parentNode;
                    }
                    if ( handler.end ){
						handler.end(stack[i].tagName);
                    }
                }

				// Remove the open elements from the stack
				stack.length = pos;
			}
		}
	};

    var errorCodes = {
        charsetIllegal: 1,
        protocolIllegal: 2,
        attrIllegal: 3,
        relIllegal: 4,
        tagsNestedIllegal: 5,
        inlineJS: 6,
        inlineCSS: 7,
        linksHrefIllegal: 8
    };
    var res={
        img:[],
        css:[],
        js:[],
        fla:[]
    };
    var rules = [
        // parse head.
        function(html, dom){
            if(!reDoctype.test(html)){
                log("html", 0, "DOCTYPE 没有顶格。", errorCodes.doctypeIllegal);
            }
            var docLen = dom.getElementsByTagName("!DOCTYPE").length;
            if(docLen == 0){
                log("html", 0, "没有设置 DOCTYPE。", errorCodes.doctypeIllegal);
            }else if(docLen > 1){
                log("html", docLen[1].startLine, "设置了超过 1 个 DOCTYPE。", errorCodes.doctypeIllegal);
            }

            var head = dom.getElementsByTagName("head");
            if(1 == head.length){
                if(head[0].childNodes.length == 0){
                    log("html", head[0].startLine, "missing document charset.", errorCodes.charseIllegal);
                }else{
                    var elem = head[0].childNodes[0];
                    if(elem.tagName && elem.tagName.toLowerCase()=="meta"){
                        if(!elem.hasAttribute("charset") &&
                          !(elem.hasAttribute("http-equiv") &&
                            elem.getAttribute("http-equiv").toLowerCase()=="content-type" &&
                            elem.hasAttribute("content") &&
                            elem.getAttribute("content").indexOf("charset")>=0)){
                                log("html", elem.startLine, "missing document charset");
                        }
                    }
                }
                var title = head[0].getElementsByTagName("title");
                if(1 == title.length){
                    // TODO: check title not empty.
                }else if(0 == title.length){
                    log("html", head[0].startLine, "missing title", errorCodes.tagsIllegal);
                }else{
                    log("html", head[0].startLine, "too much titles", errorCodes.tagsIllegal);
                }
            }else if(0 == head.length){
                log("html", 0, "missing head", errorCodes.tagsIllegal);
            }else{
                log("html", head[1].line, "too much heads", errorCodes.tagsIllegal);
            }
        },
        // checkStyle@import, 检测页内样式中是否有使用 @import
        function(html,dom){
            var styles = dom.getElementsByTagName("style");
            // @see http://www.yesky.com/imagesnew/software/css/css2/a_import.html
            var re = /@import\s+[^;]+;/g;
            for(var i=0,mat,tag,l=styles.length; i<l; i++){
                tag = styles[i].parentNode.tagName;
                if(tag && tag.toLowerCase() != "head"){
                    log("html", tag+">style", errorCodes.tagsNestedIllegal);
                }
                mat = styles[i].innerHTML.match(re);
                if(mat){
                    log("css", styles[i].startLine, mat.join(""), errorCodes.styleWithImport);
                }
            }
        },
        // check elements(inline js, inlile css, duplicate id, ...)
        function(html, dom){
            var elems = dom.getElementsByTagName("*");
            var repeatIDs=[], cache={};
            var inlinejs = "onclick,onblur,onchange,oncontextmenu,ondblclick,onfocus,onkeydown,onkeypress,onkeyup,onmousedown,onmousemove,onmouseout,onmouseover,onmouseup,onresize,onscroll,onload,onunload,onselect,onsubmit,onbeforecopy,onbeforecut,onbeforepaste,onbeforeprint,onbeforeunload".split(",");
            for(var i=0,id,l=elems.length; i<l; i++){
                if(elems[i].hasAttribute( "id")){
                    id = elems[i].getAttribute("id");
                    if(cache.hasOwnProperty("ID_"+id)){
                        repeatIDs.push(id);
                        continue;
                    }
                    cache["ID_"+id] = true;
                }
                for(var j=0,m=inlinejs.length; j<m; j++){
                    if(elems[i].hasAttribute(inlinejs[j])){
                        log("html", elems[i].startLine, elems[i].tagStart, errorCodes.inlineJS);
                    }
                }
                if(elems[i].hasAttribute("style")){
                    log("html", elems[i].startLine, elems[i].tagStart, errorCodes.inlineCSS);
                }
            }
            if(repeatIDs.length){
                log("html", 0, repeatIDs.join(","), errorCodes.idRepeated);
            }

            // We can't check tag p in p on the DOM.
            // document.getElementsByTagName("p")[i].getElementsByTagName("p").length;
            // ul>li, ol>li
            var li = dom.getElementsByTagName("li");
            for(var i=0,tag,l=li.length; i<l; i++){
                tag = li[i].parentNode.tagName.toLowerCase();
                if("ul"!=tag || "ol"!=tag){
                    log("html", li[i].startLine, tag+">"+li[i].startTag, errorCodes.tagsNestedIllegal);
                }
            }
            // dl>dt
            var dt = document.getElementsByTagName("dt");
            for(var i=0,tag,l=dt.length; i<l; i++){
                tag = dt[i].parentNode.tagName.toLowerCase();
                if("dl" != tag){
                    log("html", dt[i].startLine, tag+">"+dt[i].startTag, errorCodes.tagsNestedIllegal);
                }
            }
            // dl>dd
            var dd = document.getElementsByTagName("dd");
            for(var i=0,tag,l=dd.length; i<l; i++){
                tag = dd[i].parentNode.tagName.toLowerCase();
                if("dl" != tag){
                    log("html", dd[i].startLine, tag+">"+dd[i].tagStart, errorCodes.tagsNestedIllegal);
                }
            }
            // tr>td
            var td = document.getElementsByTagName("td");
            for(var i=0,tag,l=td.length; i<l; i++){
                tag = td[i].parentNode.tagName.toLowerCase();
                if("tr" != tag){
                    log("html", td[i].startLine, tag+">"+td[i].tagStart, errorCodes.tagsNestedIllegal);
                }
            }
        },
        // checkResources, 检测文档中的资源引用情况
        function(html, dom){
            var re=/https:\/\//i,
                re_css_rel=/^stylesheet$/i,
                re_css=/\.css$/i,
                re_empty=/^\s*$/,
                re_number=/^\d+$/;
            var checkProtocol = "https:" == location.protocol;
            var script  = dom.getElementsByTagName("script"),
                link    = dom.getElementsByTagName("link"),
                img     = dom.getElementsByTagName("img"),
                iframe  = dom.getElementsByTagName("iframe"),
                frame   = dom.getElementsByTagName("frame"),
                object  = dom.getElementsByTagName("object"),
                embed   = dom.getElementsByTagName("embed");
            for(var i=0,uri,tag,l=script.length; i<l; i++){
                tag = script[i].parentNode.tagName.toLowerCase();
                if("body" != tag){
                    log("html", script[i].startLine, tag+">script", errorCodes.tagsNestedIllegal);
                }
                if(!script[i].hasAttribute("src")){continue;}
                if(!script[i].hasAttribute("charset")){
                    log("html", script[i].startLine, script[i].tagStart, errorCodes.charsetIllegal);
                }
                uri = URI.parse(script[i].getAttribute("src"));
                if(checkProtocol && "https:" != uri.protocol){
                    log("html", script[i].startLine, script[i].tagStart, errorCodes.protocolIllegal);
                }
                res.js.push(script[i].getAttribute("src"));
            }
            for(var i=0,tag,l=link.length; i<l; i++){
                type = link[i].getAttribute("type");
                rel = link[i].getAttribute("rel");
                uri = URI.parse(link[i].getAttribute("href"));
                tag = link[i].parentNode.tagName.toLowerCase();
                if("head" != tag){
                    log("html", link[i].startLine, tag+">link", errorCodes.tagsNestedIllegal);
                }
                // All links need rel attr.
                if(!link[i].hasAttribute("rel")){
                    log("html", link[i].startLine, link[i].tagStart, errorCodes.relIllegal);
                    continue;
                }
                // favicon, stylesheet, ...
                if(checkProtocol && "https:" != uri.protocol){
                    log("html", link[i].startLine, link[i].tagStart, errorCodes.protocolIllegal);
                }
                // link[rel=stylesheet]
                if("stylesheet" != link[i].getAttribute("rel")){continue;}
                //if("text/css" != type){
                    //log("html", "外部CSS没有设置type属性。");
                //}
                if(!link[i].hasAttribute("charset")){
                    log("html", link[i].startLine, link[i].tagStart, errorCodes.charsetIllegal);
                }
                res.css.push(link[i].getAttribute("href"));
            }
            for(var i=0,l=img.length; i<l; i++){
                var attrs = [];
                uri=URI.parse(img[i].getAttribute("src"));
                if(checkProtocol && "https:" != uri.protocol){
                    log("html", img[i].startLine, img[i].tagStart, errorCodes.protocolIllegal);
                }
                if(!img[i].hasAttribute("alt") || re_empty.test(img[i].getAttribute("alt"))){
                    attrs.push("alt");
                }
                if(!img[i].hasAttribute("width") || !re_number.test(img[i].getAttribute("width"))){
                    attrs.push("width");
                }
                if(!img[i].hasAttribute("height") || !re_number.test(img[i].getAttribute("height"))){
                    attrs.push("height");
                }
                log("html", img[i].startLine, "missing "+attrs.join()+". "+img[i].tagStart, errorCodes.attrIllegal);
                res.img.push(img[i].getAttribute("src"));
            }
            var frames = iframe.concat(frame);
            for(var i=0,l=frames.length; i<l; i++){
                uri=URI.parse(frames[i].getAttribute("src"));
                if(checkProtocol && "https:" != uri.protocol){
                    log("html", frames[i].startLine, frames[i].tagStart, errorCodes.protocolIllegal);
                }
            }
            for(var i=0,l=object.length; i<l; i++){
                if(object[i].getAttribute("codebase")){
                    uri = URI.parse(object[i].getAttribute("codebase"));
                    if(checkProtocol && "https:"!=uri.protocol){
                        log("html", object[i].startLine, '<object codebase="'+object[i].getAttribute("codebase")+'"', errorCodes.protocolIllegal);
                    }
                }
                var params=object[i].getElementsByTagName("param");
                for(var j=0,m=params.length; j<m; j++){
                    if("movie"==params[j].getAttribute("name") ||
                      "src"==params[j].getAttribute("src")){
                        uri=URI.parse(params[j].getAttribute("value"));
                        if(checkProtocol && "https:" != uri.protocol){
                            log("html", params[i].startLine, params[j].tagStart, errorCodes.protocolIllegal);
                        }
                        res.fla.push(params[j].getAttribute("value"));
                        break;
                    }
                }
            }
            for(var i=0,l=embed.length; i<l; i++){
                if(!embed[i].hasAttribute("src")){continue;}
                uri=URI.parse(embed[i].getAttribute("src"));
                if(checkProtocol && "https:"!=uri.protocol){
                    log("html", embed[i].startLine, embed[i].tagStart, errorCodes.protocolIllegal);
                }
                res.fla.push(embed[i].getAttribute("src"));
            }
        },
        // checkLinksUsage, 检测页面链接可用性，硬编码等
        function(html, dom){
            var links = dom.getElementsByTagName("a");
            for(var i=0,href,uri,l=links.length; i<l; i++){
                if(!links[i].hasAttribute("href")){continue;}
                href = links[i].getAttribute("href");
                if(href.indexOf("#")==0){continue;}
                if(/javascript:void(0);?/.test(href)){continue;}
                uri = URI.parse(links[i].getAttribute("href"));
                if(uri.hostname.indexOf("alipay.net")>=0 ||
                    uri.hostname.indexOf("localhost")==0 ||
                    0==href.indexOf("$")){ // href="$xxServer.getURI('...')"
                    log("html", links[i].startLine, links[i].tagStart, errorCodes.linksHrefIllegal);
                }
                // XXX: 站内地址检测是否有效(404)，仅限于SIT环境。
            }
        }
    ];
    this.HTMLint = function(html){
        var parse = HTMLParser(html, {});
        var err = parse.error;
        var dom = parse.dom;
        htmlErrors = [];

        for(var i=0,l=rules.length; i<l; i++){
            rules[i].call(this, html, dom);
        }
        err = err.concat(htmlErrors);
        return err;
    };

	this.HTMLtoXML = function( html ) {
		var results = "";

		HTMLParser(html, {
            doctype: function(tag){
                results += tag;
            },
			start: function( tag, attrs, unary ) {
				results += "<" + tag;

				for ( var i = 0; i < attrs.length; i++ )
					results += " " + attrs[i].name + '="' + attrs[i].escaped + '"';

				results += (unary ? "/" : "") + ">";
			},
			end: function( tag ) {
				results += "</" + tag + ">";
			},
			chars: function( text ) {
				results += text;
			},
			comment: function( text ) {
				results += "<!--" + text + "-->";
			}
		});

		return results;
	};

	this.HTMLtoDOM = function( html, doc ) {
		// There can be only one of these elements
		var one = makeMap("html,head,body,title");

		// Enforce a structure for the document
		var structure = {
			link: "head",
			base: "head"
		};

		if ( !doc ) {
			if ( typeof DOMDocument != "undefined" )
				doc = new DOMDocument();
			else if ( typeof document != "undefined" && document.implementation && document.implementation.createDocument )
				doc = document.implementation.createDocument("", "", null);
			else if ( typeof ActiveX != "undefined" )
				doc = new ActiveXObject("Msxml.DOMDocument");

		} else
			doc = doc.ownerDocument ||
				doc.getOwnerDocument && doc.getOwnerDocument() ||
				doc;

		var elems = [],
			documentElement = doc.documentElement ||
				doc.getDocumentElement && doc.getDocumentElement();

		// If we're dealing with an empty document then we
		// need to pre-populate it with the HTML document structure
		if ( !documentElement && doc.createElement ) (function(){
			var html = doc.createElement("html");
			var head = doc.createElement("head");
			head.appendChild( doc.createElement("title") );
			html.appendChild( head );
			html.appendChild( doc.createElement("body") );
			doc.appendChild( html );
		})();

		// Find all the unique elements
		if ( doc.getElementsByTagName )
			for ( var i in one )
				one[ i ] = doc.getElementsByTagName( i )[0];

		// If we're working with a document, inject contents into
		// the body element
		var curParentNode = one.body;

		HTMLParser( html, {
			start: function( tagName, attrs, unary ) {
				// If it's a pre-built element, then we can ignore
				// its construction
				if ( one[ tagName ] ) {
					curParentNode = one[ tagName ];
					return;
				}

				var elem = doc.createElement( tagName );

				for ( var attr in attrs )
					elem.setAttribute( attrs[ attr ].name, attrs[ attr ].value );

				if ( structure[ tagName ] && typeof one[ structure[ tagName ] ] != "boolean" )
					one[ structure[ tagName ] ].appendChild( elem );

				else if ( curParentNode && curParentNode.appendChild )
					curParentNode.appendChild( elem );

				if ( !unary ) {
					elems.push( elem );
					curParentNode = elem;
				}
			},
			end: function( tag ) {
				elems.length -= 1;

				// Init the new parentNode
				curParentNode = elems[ elems.length - 1 ];
			},
			chars: function( text ) {
				curParentNode.appendChild( doc.createTextNode( text ) );
			},
			comment: function( text ) {
				// create comment node
			}
		});

		return doc;
	};

	function makeMap(str){
		var obj = {}, items = str.split(",");
		for ( var i = 0; i < items.length; i++ )
			obj[ items[i] ] = true;
		return obj;
	}
})();