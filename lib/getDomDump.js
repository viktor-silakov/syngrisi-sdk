const getDomDump = function (done) {
    function isVisible(el) {
        while (el) {
            if (el === document) {
                return true;
            }

            var $style = window.getComputedStyle(el, null);

            if (!el) {
                return false;
            } else if (!$style) {
                return false;
            } else if ($style.display === 'none') {
                return false;
            } else if ($style.visibility === 'hidden') {
                return false;
            } else if (+$style.opacity === 0) {
                return false;
            } else if (($style.display === 'block' || $style.display === 'inline-block') &&
                $style.height === '0px' && $style.overflow === 'hidden') {
                return false;
            } else {
                return $style.position === 'fixed' || isVisible(el.parentNode);
            }
        }
    }

    function getDomPath(el) {
        let stack = [];
        while (el.parentNode != null) {
            let sibCount = 0;
            let sibIndex = 0;
            for (let i = 0; i < el.parentNode.childNodes.length; i++) {
                let sib = el.parentNode.childNodes[i];
                if (sib.nodeName == el.nodeName) {
                    if (sib === el) {
                        sibIndex = sibCount;
                    }
                    sibCount++;
                }
            }
            if (el.hasAttribute('id') && el.id != '') {
                stack.unshift(el.nodeName.toLowerCase() + '#' + el.id);
            } else if (sibCount > 1) {
                stack.unshift(el.nodeName.toLowerCase() + ':eq(' + sibIndex + ')');
            } else {
                stack.unshift(el.nodeName.toLowerCase());
            }
            el = el.parentNode;
        }
        return stack.slice(1)
    }

    function dumpElement(el) {
        return {
            tag: el.tagName,
            id: el.id,
            ...el.getBoundingClientRect().toJSON(),
            domPath: getDomPath(el)
        }
    }

    const elements = Array.from(document.body.getElementsByTagName("*")).filter(x => isVisible(x));

    let dumpElements = [];

    for (const el of elements) {
        dumpElements.push(dumpElement(el))
    }

    const result = JSON.stringify(dumpElements, null, "\t")
    done(result)
    return result;
}

module.exports = {
    getDomDump: getDomDump
}
