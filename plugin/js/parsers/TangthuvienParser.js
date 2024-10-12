"use strict";
parserFactory.register("truyen.tangthuvien.vn", () => new TangthuvienParser());
class TangthuvienParser extends Parser {
  constructor() {
    super();
  }

  // returns promise with the URLs of the chapters to fetch
  // promise is used because may need to fetch the list of URLs from internet
  async getChapterUrls(dom, chapterUrlsUI) {
    let urlsOfTocPages = this.getUrlsOfTocPages(dom);

    let chapters = await this.getChaptersFromAllTocPages([],
      this.extractPartialChapterList,
      urlsOfTocPages,
      chapterUrlsUI
    );

    const seenDividers = new Set();
    const uniqueChapters = chapters.map(chapter => {
      // Tìm kiếm divider_chap_ trong title.
      const dividerMatch = chapter.title.match(/\[divider_chap_([^\]]+)\]/);

      if (dividerMatch) {
        const divider = dividerMatch[0]; // Lấy toàn bộ chuỗi như [divider_chap_...]
        if (!seenDividers.has(divider)) {
          // Nếu chưa gặp divider_chap_ này, thêm nó vào Set và giữ lại trong title.
          seenDividers.add(divider);
          // loại bỏ divider_chap_ khỏi title.
          chapter.title = chapter.title.replace('divider_chap_','').trim();

          return chapter; // Giữ nguyên title
        } else {
          // Nếu đã gặp divider_chap_ này trước đó, loại bỏ nó khỏi title.
          const updatedTitle = chapter.title.replace(divider, '').trim();
          return {
            ...chapter,
            title: updatedTitle
          };
        }
      } else {
        // Nếu không có divider_chap_, giữ nguyên chapter.
        return chapter;
      }
    });

    return uniqueChapters;
  }


  // This static method retrieves the URLs of the table of contents (TOC) pages from the provided DOM.
  getUrlsOfTocPages(dom) {
    // Retrieve the story_id from the hidden input field
    const story_id = dom.querySelector("input#story_id_hidden")?.value;
    if (!story_id) return [];

    // Construct the base URL using the story_id
    const base = `https://truyen.tangthuvien.vn/doc-truyen/page/${story_id}?web=1&limit=75`;
    const pagination = dom.querySelector("ul.pagination");
    if (!pagination) return [`${base}&page=0`]; // If no pagination is found, assume only one page

    // Retrieve the last page element and its text content
    const lastPageElement = pagination.querySelector("li:last-child a");
    let totalPage = TangthuvienParser.determineTotalPages(
      lastPageElement,
      pagination
    ); // Determine the total number of pages

    if (!totalPage) return [`${base}&page=0`]; // Default to page 0 if unable to determine total pages
    // Generate and return an array of URLs for all the TOC pages
    return Array.from({ length: totalPage }, (_, i) => `${base}&page=${i}`);
  }

  // Separate method to determine total pages, for better structure and readability
  static determineTotalPages(lastPageElement, pagination) {
    // Extract the text content of the last page element
    const lastPageText = lastPageElement?.textContent.trim();
    if (lastPageText === "Trang cuối") {
      // Attempt to extract and parse the total number of pages from the onclick attribute
      const match = lastPageElement.getAttribute("onclick").match(/\d+/);
      return match ? parseInt(match[0]) + 1 : undefined;
    } else if (lastPageText === "»") {
      // If the last page text indicates a 'next' button, determine total pages based on the number of links
      return pagination.querySelectorAll("a").length;
    } else {
      // If no reliable method to determine, return undefined or an appropriate fallback
      return undefined;
    }
  }

  extractPartialChapterList(dom) {
    // Initialize variables
    let divider_chap = null;
    const chapterLinks = [];
    const elements = [...dom.querySelectorAll("ul.cf li")];

    // Iterate through the elements
    for (const element of elements) {
      // Check if the element is a divider
      if (element.classList.contains("divider-chap")) {
        divider_chap = element.textContent.trim();
      } else {
        // Get the link element
        const link = element.querySelector("a");
        if (link) {
          // Push the chapter details to the array
          chapterLinks.push({
            sourceUrl: link.href,
            title: TangthuvienParser.formatTitle(link, divider_chap)
          });
          divider_chap = null; // reset divider_chap after using it
        }
      }
    }


    // Return the array of chapter links
    return chapterLinks;
  }

  /**
   * Formats the title from the text content of a link element.
   * It trims the title, replaces multiple spaces with a single space,
   * capitalizes the first letter after any colon, and optionally prefixes with a chapter divider.
   *
   * @param {Element} link - The DOM element containing the title text.
   * @param {string|null} divider_chap - The chapter divider to prefix, if any.
   * @return {string} The formatted title.
   */
  static formatTitle(link, divider_chap) {
    // Decode HTML entities (e.g., &nbsp; -> space, &eacute; -> é).
    let title = link.textContent.trim().replace(/\s+/g, ' ');
    title = new DOMParser().parseFromString(title, 'text/html').body.textContent || '';

    // Remove any duplicate colons.
    title = title.replace(/:\s*:/g, ':').trim();

    // Capitalize the first letter after any colon, ensuring proper spacing.
    title = title.replace(/:\s*([a-z])/g, (match, char) => `: ${char.toUpperCase()}`);

    // If a chapter divider is provided, prefix it to the title.
    if (divider_chap != null) {
      title = `[divider_chap_${divider_chap}] ${title}`;
    }

    return title;
  }





  // returns the element holding the story content in a chapter
  findContent(dom) {
    // Check and retrieve the chapter title
    const chapterTitleElement = dom.querySelector("div.content .chapter h2");
    if (!chapterTitleElement) {
      throw new Error("Chapter title not found");
    }
    const chapterTitle = chapterTitleElement.textContent.trim();

    // Check and retrieve the article content
    const contentNode = dom.querySelector("div.box-chap");
    if (!contentNode) {
      throw new Error("Article content not found");
    }

    // Remove unnecessary elements
    util.removeChildElementsMatchingCss(
      contentNode,
      "script, br"
    );

    // Split and process text segments
    // let textSegments = TangthuvienParser.getTextSegments(contentNode);
    let textSegments = contentNode.innerHTML.split('\n\n');

    // Create a new DOM and add the title
    let newDom = new DOMParser().parseFromString(
      `<div id="article" class="c-c"><h2>${chapterTitle}</h2></div>`,
      "text/html"
    );
    let newHtml = newDom.querySelector("#article");

    // Add text segments to newHtml
    TangthuvienParser.addTextSegmentsToDom(newHtml, textSegments, chapterTitle);
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
    const normalizedChapterTitle =
      TangthuvienParser.normalizeString(chapterTitle);
    // Iterate through text segments and add to DOM
    textSegments.forEach((segment, index) => {
      // Skip adding the segment if it contains or is contained in the chapter title
      if (index === 0) {
        const normalizedSegment = TangthuvienParser.normalizeString(segment);
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

  // title of the story  (not to be confused with title of each chapter)
  extractTitleImpl(dom) {
    // typical implementation is find node with the Title and return name from title
    // NOTE. Can return Title as a string, or an  HTML element
    return dom.querySelector(".book-info h1");
  }

  // author of the story
  // Optional, if not provided, will default to "<unknown>"

  extractAuthor(dom) {
    // typical implementation is find node with the author's name and return name from title
    // Major points to note
    //   1. Return the Author's name as a string, not a HTML element
    //   2. If can't find Author, call the base implementation
    let authorLabel = dom.querySelector(
      "div.book-information div.book-info a[href*='/tac-gia']"
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
    let tag = dom.querySelector("p.tag a:last-child");
    return tag ? tag.textContent.trim() : "";
  }

  // Description of the story
  // Optional, Description for metadata, if not provided, will default to ""

  extractDescription(dom) {
    return dom.querySelector("div.book-intro").textContent.trim();
  }

  // Optional, supply if need to do special manipulation of content
  // e.g. decrypt content

  // customRawDomToContentStep(webPage, content) {
    // for example of this, refer to LnmtlParser
    // Parse the HTML content string into a DOM object
    // let newDom = new DOMParser().parseFromString(content, "text/html");
    // let newContent = content.querySelector("div");
    // console.log(`customRawDomToContentStep`, webPage, content);
  // }

  // Optional, supply if need to do custom cleanup of content
  /*
    removeUnwantedElementsFromContentElement(element) {
        util.removeChildElementsMatchingCss(element, "button");
        super.removeUnwantedElementsFromContentElement(element);
    }
    */

  // Optional, supply if individual chapter titles are not inside the content element
  findChapterTitle(dom) {
    // typical implementation is find node with the Title
    // Return Title element, OR the title as a string
    return dom.querySelector("div.content .chapter h2").textContent;
  }

  // Optional, if "next/previous chapter" are nested inside other elements,
  // this says how to find the highest parent element to remove
  /*
    findParentNodeOfChapterLinkToRemoveAt(link) {
        // The links may be wrapped, so need to walk up tree to find the 
        // highest element holding the chapter links.
        // e.g. Following code assumes links are sometimes enclosed in a <strong> tag
        // that is enclosed in a <p> tag.  We want to remove the <p> tag
        // and everything inside it
        let toRemove = util.moveIfParent(link, "strong");
        return util.moveIfParent(toRemove, "p");    
    }
    */

  // Optional, supply if cover image can usually be found on inital web page
  // Notes.
  //   1. If cover image is first image in content section, do not implement this function

  findCoverImageUrl(dom) {
    // Most common implementation is get first image in specified container. e.g.
    return util.getFirstImgSrc(dom, "div.book-img");
  }

  // Optional, supply if need to chase hyperlinks in page to get all chapter content
  /*
    async fetchChapter(url) {
        return (await HttpClient.wrapFetch(url)).responseXML;
    }
    */

  // Optional, supply if need to modify DOM before normal processing steps
  /*
    preprocessRawDom(webPageDom) {
    }
    */

  // Optional, supply if source has 100s of chapters and there's lots of
  // elements in DOM that are not included in the epub.
  /*
    removeUnusedElementsToReduceMemoryConsumption(chapterDom) {
        super.removeUnusedElementsToReduceMemoryConsumption(webPageDom);
    }
    */

  // Optional, called when user presses the "Pack EPUB" button.
  // Implement if parser needs to do anything after user sets UI settings
  // but before collecting pages
  /*
    onStartCollecting() {
    }
    */

  // Optional, Return elements from page
  // that are to be shown on epub's "information" page

  getInformationEpubItemChildNodes(dom) {
    return [...dom.querySelectorAll("div.book-intro")];
  }

  // Optional, Any cleanup operations to perform on the nodes
  // returned by getInformationEpubItemChildNodes
  /*
    cleanInformationNode(node) {
        return node;
    }
    */
}
