"use strict";

// Register the parser for the domain "truyendocviet.vn"
parserFactory.register("truyendocviet.vn", () => new TruyendocvietParser());

/**
 * Parser for truyendocviet.vn content.
 * Extends the base Parser class to provide methods for extracting novel metadata and chapter data.
 */
class TruyendocvietParser extends Parser {
  constructor() {
    super();
  }

  /**
   * Retrieves all chapter URLs by first getting the list of TOC page URLs,
   * then extracting chapters from each page.
   *
   * @param {Document} dom - The DOM object of the initial page.
   * @param {any} chapterUrlsUI - (Optional) UI element for chapter URLs (if needed).
   * @returns {Promise<Array<Object>>} - An array of chapter objects.
   */
  async getChapterUrls(dom, chapterUrlsUI) {
    const tocPageUrls = this.getUrlsOfTocPages(dom);
    const chapters = await this.getChaptersFromAllTocPages(
      [],
      this.extractPartialChapterList,
      tocPageUrls,
      chapterUrlsUI
    );
    return chapters;
  }

  /**
   * Generates a list of Table of Contents (TOC) page URLs based on the total chapter count.
   *
   * @param {Document} dom - The DOM object of the initial page.
   * @returns {Array<string>|null} - An array of TOC page URLs or null if JSON data extraction fails.
   */
  getUrlsOfTocPages(dom) {
    const jsonData = TruyendocvietParser.getJsonDataFromDom(dom);
    if (!jsonData) {
      return null;
    }

    const alias = jsonData.CurrentBook.Alias;
    // Construct the base URL for the TOC pages.
    const tocBaseUrl = `https://${jsonData.Host}/doc-truyen/${alias}/read/chapters`;
    const totalChapters = jsonData.CurrentBook.ChapterCount;
    // Determine the total number of pages (50 chapters per page).
    const totalPages = Math.ceil(totalChapters / 50);

    if (!totalPages) {
      // Fallback to a single page if total pages cannot be determined.
      return [`${tocBaseUrl}/1.html`];
    }
    console.log(`getUrlsOfTocPages: ${totalPages} pages`);

    // Generate URLs for all TOC pages.
    return Array.from({ length: totalPages }, (_, i) => `${tocBaseUrl}/${i + 1}.html`);
  }

  /**
   * Extracts a partial list of chapters from a TOC page.
   * It constructs chapter URLs and cleans chapter titles.
   *
   * @param {Document} dom - The DOM object of the TOC page.
   * @returns {Array<Object>} - An array of chapter objects with sourceUrl and title.
   */
  extractPartialChapterList(dom) {
    let chapterLinks = [];
    const jsonData = TruyendocvietParser.getJsonDataFromDom(dom);
    if (!jsonData) {
      return chapterLinks;
    }

    // Validate required JSON data fields.
    if (
      !jsonData.CurrentBook ||
      !jsonData.Host ||
      !jsonData.PageData
    ) {
      console.error("Incomplete JSON data: Missing CurrentBook, Host, or PageData.");
      return chapterLinks;
    }

    // Ensure arrChapters exists and is a non-empty array.
    if (
      typeof jsonData.PageData.arrChapters === "undefined" ||
      !Array.isArray(jsonData.PageData.arrChapters) ||
      jsonData.PageData.arrChapters.length === 0
    ) {
      console.error("arrChapters is missing, not an array, or empty.");
      return chapterLinks;
    }

    const alias = jsonData.CurrentBook.Alias;
    const chapterUrlBase = `https://${jsonData.Host}/doc-truyen/${alias}/read/`;
    const novelTitle = jsonData.CurrentBook?.ContentTitle?.trim() || "";

    // Map each chapter entry to an object containing the chapter URL and cleaned title.
    chapterLinks = jsonData.PageData.arrChapters.map((chapter) => ({
      sourceUrl: chapterUrlBase + chapter._id + ".html",
      title: TruyendocvietParser.cleanChapterTitle(chapter.ContentTitle, novelTitle)
    }));

    return chapterLinks;
  }

  /**
   * Cleans a raw chapter title by removing the novel title (if present),
   * stripping extra delimiters, and removing trailing metadata (only if it contains "(length").
   *
   * @param {string} rawTitle - The raw chapter title.
   * @param {string} novelTitle - The title of the novel.
   * @returns {string} - The cleaned chapter title.
   */
  static cleanChapterTitle(rawTitle, novelTitle) {
    let chapterTitle = rawTitle;

    // If the raw title starts with the novel title, remove that part.
    if (novelTitle && rawTitle.startsWith(novelTitle)) {
      chapterTitle = rawTitle.slice(novelTitle.length).trim();
      // Remove any leading delimiters such as "-", ":", or commas.
      chapterTitle = chapterTitle.replace(/^[-:,\s]+/, "");
    } else {
      // If the title contains a hyphen, check if the first part matches the novel title.
      const parts = rawTitle.split(" - ");
      if (parts.length > 1 && parts[0].trim() === novelTitle) {
        chapterTitle = parts.slice(1).join(" - ").trim();
      }
    }

    // Remove trailing metadata only if it contains "(length"
    if (/\(.*length.*\)$/.test(chapterTitle)) {
      chapterTitle = chapterTitle.replace(/\s*\(.*?\)$/, "").trim();
    }
    return chapterTitle;
  }

  /**
   * Extracts JSON data from the provided DOM by locating the <script> tag that contains "window.__INITIAL_DATA__".
   *
   * @param {Document} dom - The DOM from which to extract the JSON data.
   * @returns {Object|null} - The parsed JSON object or null if extraction fails.
   */
  static getJsonDataFromDom(dom) {
    // Locate the <script> element containing the JSON data.
    const scriptContent = Array.from(dom.querySelectorAll("script"))
      .map((script) => script.textContent)
      .find((text) => text.includes("window.__INITIAL_DATA__"));

    if (!scriptContent) {
      console.error("Script containing 'window.__INITIAL_DATA__' not found.");
      return null;
    }

    // Extract the JSON string using a regular expression.
    const regex = /window\.__INITIAL_DATA__\s*=\s*(\{.*\});?/s;
    const match = scriptContent.match(regex);
    if (!match || !match[1]) {
      console.error("Unable to extract JSON data from the script.");
      return null;
    }

    let jsonStr = match[1];

    // Replace new Date("...") with a plain date string.
    jsonStr = jsonStr.replace(/new Date\("([^"]+)"\)/g, '"$1"');

    // Replace 'undefined' with null.
    jsonStr = jsonStr.replace(/\bundefined\b/g, "null");

    // Parse and return the JSON object.
    try {
      return JSON.parse(jsonStr);
    } catch (error) {
      console.error("Error parsing JSON:", error);
      return null;
    }
  }

  /**
   * Extracts the title of the novel from the JSON data.
   *
   * @param {Document} dom - The DOM from which to extract the title.
   * @returns {string|null} - The trimmed novel title or null if not found.
   */
  extractTitle(dom) {
    const jsonData = TruyendocvietParser.getJsonDataFromDom(dom);
    if (!jsonData || !jsonData.CurrentBook || !jsonData.CurrentBook.ContentTitle) {
      console.error("Invalid data: Missing CurrentBook or ContentTitle.");
      return null;
    }
    return jsonData.CurrentBook.ContentTitle.trim();
  }

  /**
   * Constructs the full URL for the cover image from the JSON data.
   *
   * @param {Document} dom - The DOM from which to extract the cover image URL.
   * @returns {string|null} - The complete cover image URL or null if not found.
   */
  findCoverImageUrl(dom) {
    const jsonData = TruyendocvietParser.getJsonDataFromDom(dom);
    if (!jsonData || !jsonData.CurrentBook || !jsonData.CurrentBook.Thumbnail) {
      console.error("Invalid data: Missing CurrentBook or Thumbnail.");
      return null;
    }
    return `https://${jsonData.Host}${jsonData.CurrentBook.Thumbnail.trim()}`;
  }

  /**
   * Extracts the description (recap) of the novel from the JSON data.
   *
   * @param {Document} dom - The DOM from which to extract the description.
   * @returns {string|null} - The trimmed description or null if not found.
   */
  extractDescription(dom) {
    const jsonData = TruyendocvietParser.getJsonDataFromDom(dom);
    if (!jsonData || !jsonData.CurrentBook || !jsonData.CurrentBook.Recap) {
      console.error("Invalid data: Missing CurrentBook or Recap.");
      return null;
    }
    return jsonData.CurrentBook.Recap.trim();
  }

  /**
   * Returns the language code used in the content.
   *
   * @returns {string} - The language ISO code ("vi" for Vietnamese).
   */
  extractLanguage() {
    return "vi";
  }

  /**
   * Extracts the author of the novel from the JSON data.
   * Falls back to the base Parser's extractAuthor method if extraction fails.
   *
   * @param {Document} dom - The DOM from which to extract the author.
   * @returns {string} - The author's name or a fallback value.
   */
  extractAuthor(dom) {
    const jsonData = TruyendocvietParser.getJsonDataFromDom(dom);
    if (!jsonData) {
      return super.extractAuthor(dom);
    }

    // Validate that the CurrentBook and Authors data exists.
    if (
      !jsonData.CurrentBook ||
      !jsonData.CurrentBook.Authors ||
      jsonData.CurrentBook.Authors.length === 0
    ) {
      console.error("Invalid data: Missing CurrentBook or Authors.");
      return super.extractAuthor(dom);
    }

    // Convert the first author's _id to a string for comparison.
    const currentAuthorId = jsonData.CurrentBook.Authors[0].toString();

    // Search for the author in the CommonData authors list.
    const authorsList = jsonData.CommonData && jsonData.CommonData.authors;
    const author = authorsList ? authorsList.find(item => item._id === currentAuthorId) : null;

    if (author) {
      return author.ContentTitle;
    } else {
      console.warn("Author not found for _id:", currentAuthorId);
      return super.extractAuthor(dom);
    }
  }

  /**
   * Extracts the genre/subject of the novel based on its sub-category IDs.
   * Matches the IDs from CurrentBook.SubCategories with the category list.
   *
   * @param {Document} dom - The DOM from which to extract the subject.
   * @returns {string} - A comma-separated string of category names or an empty string if none found.
   */
  extractSubject(dom) {
    const jsonData = TruyendocvietParser.getJsonDataFromDom(dom);
    if (
      jsonData &&
      jsonData.CurrentBook &&
      Array.isArray(jsonData.CurrentBook.SubCategories)
    ) {
      const subCatIds = jsonData.CurrentBook.SubCategories;
      // Validate that category data exists. Note: Adjust the property name if needed.
      if (jsonData.CommonData && Array.isArray(jsonData.Categories)) {
        // Filter categories based on matching _id values.
        const matchingCategories = jsonData.Categories.filter(cat =>
          subCatIds.includes(cat._id)
        );
        if (matchingCategories.length > 0) {
          return matchingCategories.map(cat => cat.CategoryName).join(", ");
        }
      } else {
        console.error("Invalid or missing categories data in CommonData.");
      }
    }
    return "";
  }

  /**
   * Extracts and cleans the chapter title from the JSON data.
   * Removes the novel title prefix (if present) and trailing metadata (if it contains "(length").
   *
   * @param {Document} dom - The DOM from which to extract the chapter title.
   * @returns {string|null} - The cleaned chapter title or null if extraction fails.
   */
  findChapterTitle(dom) {
    const jsonData = TruyendocvietParser.getJsonDataFromDom(dom);
    if (
      !jsonData ||
      !jsonData.PageData ||
      !jsonData.PageData.chapterInfo ||
      !jsonData.PageData.chapterInfo.ContentTitle
    ) {
      console.error("Invalid PageData or chapterInfo data.");
      return null;
    }

    // Retrieve the raw chapter title and the novel title.
    const rawChapterTitle = jsonData.PageData.chapterInfo.ContentTitle.trim();
    const novelTitle = jsonData.CurrentBook?.ContentTitle?.trim() || "";
    console.log("novelTitle:", novelTitle);

    // Clean the chapter title using the helper function.
    const chapterTitle = TruyendocvietParser.cleanChapterTitle(rawChapterTitle, novelTitle);
    console.log("chapterTitle:", chapterTitle);
    return chapterTitle;
  }

  /**
   * Retrieves the content of a chapter as an HTML element.
   *
   * @param {Document} dom - The DOM from which to extract the chapter content.
   * @returns {HTMLElement|null} - The article element containing the chapter content, or null if not found.
   */
  findContent(dom) {
    const jsonData = TruyendocvietParser.getJsonDataFromDom(dom);
    if (!jsonData) {
      return null;
    }
    // Validate that the chapter description exists.
    if (
      !jsonData.PageData ||
      !jsonData.PageData.chapterInfo ||
      !jsonData.PageData.chapterInfo.Description
    ) {
      console.error("Invalid JSON: Missing chapter description in PageData.");
      return null;
    }

    // Wrap the description in an <article> element and parse it as HTML.
    const rawHtml = `<article>${jsonData.PageData.chapterInfo.Description}</article>`;
    return new DOMParser().parseFromString(rawHtml, "text/html").querySelector("article");
  }
}
