/*
  parses metruyencv.com
*/
"use strict";

parserFactory.register("metruyencv.com", () => new MetruyenchuParser());

class MetruyenchuParser extends Parser {
  constructor() {
    super();
  }

  async getChapterUrls(dom) {
    return [...dom.querySelectorAll("div#chapter-list a")].map(
      this.linkToChapter
    );
  }

  // This function extracts the link to each chapter and removes any unnecessary elements
  linkToChapter(link) {
    util.removeChildElementsMatchingCss(link, "small");
    return {
      sourceUrl: link.href,
      title: link.textContent.trim(),
    };
  }
  // title of the story  (not to be confused with title of each chapter)
  extractTitleImpl(dom) {
    return dom.querySelector("div.page-content div.media h1");
  }

  // author of the story
  // Optional, if not provided, will default to "<unknown>"
  extractAuthor(dom) {
    // typical implementation is find node with the author's name and return name from title
    // Major points to note
    //   1. Return the Author's name as a string, not a HTML element
    //   2. If can't find Author, call the base implementation
    let authorLabel = dom.querySelector(
      "div.page-content div.media a[href*='tac-gia']"
    );
    return authorLabel === null
      ? super.extractAuthor(dom)
      : authorLabel.textContent;
  }

  // language used
  // Optional, if not provided, will default to ISO code for English "en"
  extractLanguage() {
    return "vi";
  }

  // Genre of the story
  // Optional, Genre for metadata, if not provided, will default to ""
  extractSubject(dom) {
    // Select all <a> tags with href containing '?genre=' or '?tag='
    let genreTags = dom.querySelectorAll(
      "div.page-content div.media a[href*='?genre=']"
    );
    let tagTags = dom.querySelectorAll(
      "div.page-content div.media a[href*='?tag=']"
    );

    // Combine both node lists into an array and remove duplicates if any
    let allTags = Array.from(new Set([...genreTags, ...tagTags]));

    // Map over the combined array to extract text content and trim it
    return allTags.map((e) => e.textContent.trim()).join(", ");
  }

  // Optional, supply if cover image can usually be found on inital web page
  // Notes.
  //   1. If cover image is first image in content section, do not implement this function
  findCoverImageUrl(dom) {
    // Most common implementation is get first image in specified container. e.g.
    return util.getFirstImgSrc(dom, "div.page-content div.media .nh-thumb");
  }

  // Description of the story
  // Optional, Description for metadata, if not provided, will default to ""
  extractDescription(dom) {
    let descriptionElement = dom.querySelector("#nav-intro .content p");
    return descriptionElement === null
      ? ""
      : descriptionElement.textContent.trim();
  }
  // Optional, supply if individual chapter titles are not inside the content element
  findChapterTitle(dom) {
    // typical implementation is find node with the Title
    // Return Title element, OR the title as a string
    return dom.querySelector("#js-read__body .h1");
  }

  // async fetchChapter(url) {
  //     let dom = await super.fetchChapter(url);
  //     this.addTitleToChapter(url, dom)
  //     return dom;
  // }


  // returns the element holding the story content in a chapter
  findContent(dom) {
    // Check and retrieve the chapter title
    const chapterTitleElement = dom.querySelector("#js-read__body .h1");
    if (!chapterTitleElement) {
      throw new Error("Chapter title not found");
    }
    const chapterTitle = chapterTitleElement.textContent.trim();

    // Check and retrieve the article content
    const contentNode = dom.querySelector("#article");
    if (!contentNode) {
      throw new Error("Article content not found");
    }

    // Remove unnecessary elements
    util.removeChildElementsMatchingCss(
      contentNode,
      "script, div.nh-read__alert, small.text-muted, .text-center, br"
    );

    // Split and process text segments
    let textSegments = MetruyenchuParser.getTextSegments(contentNode);

    // Create a new DOM and add the title
    let newDom = new DOMParser().parseFromString(
      `<div id="article" class="c-c"><h2>${chapterTitle}</h2></div>`,
      "text/html"
    );
    let newHtml = newDom.querySelector("#article");

    // Add text segments to newHtml
    MetruyenchuParser.addTextSegmentsToDom(newHtml, textSegments, chapterTitle);

    return newHtml;
  }

  //  Helper function to normalize a string, removing extra spaces and converting to lowercase
  static normalizeString = (s) => {
    return s
      .replace(/\s+/g, " ") // Replace all spaces with a single space
      .replace(/[:\s]/g, "") // Remove colons and spaces
      .toLowerCase(); // Convert to lowercase
  };

  // Helper function to get text segments
  static getTextSegments(contentNode) {
    let textSegments = [];
    contentNode.childNodes.forEach((node) => {
      if (node.nodeType === Node.TEXT_NODE && node.textContent.trim() !== "") {
        textSegments.push(node.textContent.trim());
      }
    });
    return textSegments;
  }

  // Helper function to add text segments to the DOM
  static addTextSegmentsToDom(dom, textSegments, chapterTitle) {
    // Convert chapter title to normalized form
    const normalizedChapterTitle = MetruyenchuParser.normalizeString(chapterTitle);
    // Iterate through text segments and add to DOM
    textSegments.forEach((segment, index) => {
      // Skip adding the segment if it contains or is contained in the chapter title
      if (index === 0) {
        const normalizedSegment = MetruyenchuParser.normalizeString(segment);
        if (
          normalizedSegment.includes(normalizedChapterTitle) ||
          normalizedChapterTitle.includes(normalizedSegment)
        ) {
          return;
        }
      }
      // Create a new paragraph element and add the segment as its text content
      const p = document.createElement("p");
      p.textContent = segment;
      dom.appendChild(p);
    });
  }

  // Optional, supply if need to do special manipulation of content
  // e.g. decrypt content
  customRawDomToContentStep(chapter, content) {}

  // Optional, supply if need to do custom cleanup of content
  removeUnwantedElementsFromContentElement(element) {
    super.removeUnwantedElementsFromContentElement(element);
  }
  // Optional, Return elements from page
  // that are to be shown on epub's "information" page
  getInformationEpubItemChildNodes(dom) {
    return [...dom.querySelectorAll("#nav-intro .content p")];
  }

  
  
  // Below is the section for decrypting canvas to text (tested on chrome console)
  // // Decrypt content from canvas to text
  // decryptCanvasToText(dom) {
  //   // Select all <p> elements within div#article
  //   const pElements = dom.querySelectorAll('div#article p');

  //   // Sort <p> elements based on their CSS 'order' value
  //   const orderedPElements = Array.from(pElements).sort((a, b) => this.getOrderValue(a) - this.getOrderValue(b));
  
  //   // Process each <p> element to create final text content
  //   return orderedPElements.map(pElement => {
  //     // Select all child elements within each <p> and sort them
  //     const vPreElements = pElement.querySelectorAll('*');
  //     const orderedTexts = Array.from(vPreElements).sort((a, b) => this.getOrderValue(a) - this.getOrderValue(b)).map(el => this.getVPreContent(el));
  
  //     // Wrap the text in <p> tags and add a newline character
  //     return '<p>' + orderedTexts.join(' ').trim() + '</p>\n';
  //   }).join('').trim();
  // }

  // // Get the 'order' value from an element's CSS
  // getOrderValue(element) {
  //   return parseInt(window.getComputedStyle(element).getPropertyValue('order'), 10) || 0;
  // }
  
  // // Extract content from the ::after pseudo-element
  // getAfterContent(element) {
  //   const afterContent = window.getComputedStyle(element, '::after').getPropertyValue('content');
    
  //   // If content contains 'attr()', extract the corresponding attribute value
  //   if (afterContent.includes('attr(')) {
  //     const attrName = afterContent.match(/attr\((.*?)\)/)[1];
  //     return element.getAttribute(attrName).trim();
  //   }
  //   // Return content after removing any quotes
  //   return afterContent.replace(/['"]+/g, '').trim();
  // }
  
  // // Process the text content of an element
  // getVPreContent(element) {
  //   // Get text from the element and remove whitespace
  //   let text = element.textContent.trim();
  
  //   // Handle content from the ::after pseudo-element
  //   const afterText = this.getAfterContent(element);
  //   if (afterText !== 'none') {
  //     text += ' ' + afterText;
  //   }
  
  //   // Reverse the text if CSS 'direction' is rtl (right-to-left)
  //   const direction = window.getComputedStyle(element).getPropertyValue('direction');
  //   if (direction === 'rtl') {
  //     text = text.split('').reverse().join('');
  //   }
  
  //   return text;
  // }
}
