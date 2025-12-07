// src/services/storage.js

export const DEFAULT_SAFE_TERMS = [
  "email",
  "email address",
  "name",
  "first name",
  "last name",
  "password",
  "search",
  "contact",
  "contact us",
  "address",
  "city",
  "state",
  "zip",
  "phone",
  "date",
  "submit",
  "login",
  "sign up",
  "menu",
  "about",
  "home",
  "products",
  "services",
  "pricing",
  "refund policy",
  "privacy policy",
  "terms",
];

/**
 * Loads the safe list from Chrome Local Storage.
 * Returns the default list if nothing is saved.
 */
export async function loadSafeList() {
  return new Promise((resolve) => {
    chrome.storage.local.get(["safeList"], (result) => {
      if (result.safeList && Array.isArray(result.safeList)) {
        resolve(result.safeList);
      } else {
        resolve([...DEFAULT_SAFE_TERMS]);
      }
    });
  });
}

/**
 * Saves a new safe list to Chrome Local Storage.
 * @param {Array<string>} newList
 */
export async function saveSafeList(newList) {
  return new Promise((resolve) => {
    chrome.storage.local.set({ safeList: newList }, () => {
      resolve(newList);
    });
  });
}
