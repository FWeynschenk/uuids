import React, { useState, useCallback, useEffect, useLayoutEffect, useRef } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { encodeBase62, decodeBase62 } from './utils/base62';
import { formatBigIntAsUUID, deriveUUIDFromLocation, findLocationFromUUID, parseUUIDtoBigInt, forceV4Bits } from './utils/uuid';
import SearchBox from './components/SearchBox';
import './App.css'; // Contains all the new fancy styles

// Constants
const INITIAL_WINDOW_SIZE = 101; // Odd number to have a clear center
const HALF_WINDOW = Math.floor(INITIAL_WINDOW_SIZE / 2);
const LOAD_BUFFER = 15; // How close to the edge triggers loading more
const LOAD_AMOUNT = 50; // How many items to load at once
const ESTIMATED_ITEM_HEIGHT = 45; // Adjusted estimate based on new padding/font size
const MAX_UUID_VAL = (1n << 128n) - 1n;

// --- Theme Content (More Sales Pitchy) ---
const themeContent = {
    space: {
        title: "Chart the Cosmic UUID Ocean",
        pitch1Title: "🔭 Peer into Infinity",
        pitch1Text: "Navigate the celestial sea of 2^128 unique identifiers. Every UUID a star, every scroll a voyage to the unknown.",
        pitch2Title: "✨ Claim Your Digital Constellation",
        pitch2Text: "Is your essential UUID lost among the nebulae? Pinpoint its location and bring it back to your digital harbor.",
        pitch3Title: "🚀 Hyperspeed Scrolling",
        pitch3Text: "Engage warp drive! Our virtualized engine lets you traverse galactic clusters of IDs without breaking a sweat.",
        themeToggleTitle: "Switch to Cyberpunk Grid"
    },
    cyberpunk: {
        title: "Access the UUID Undergrid",
        pitch1Title: "🔌 Hack the Datascape",
        pitch1Text: "Dive deep into the neon-drenched grid of 2^128 IDs. Uncover hidden patterns and claim the secrets within the data stream.",
        pitch2Title: "⚡ Hunt Rogue Signals",
        pitch2Text: "Track down that elusive UUID ghosting through the circuits. No identifier can escape your targeted net search.",
        pitch3Title: "💻 Ghost-in-the-Machine Speed",
        pitch3Text: "Render gigabytes of IDs like flickering holograms. Experience seamless navigation through the digital maze.",
        themeToggleTitle: "Switch to SaaS Platform"
    },
    saas: {
        title: "Enterprise UUID Verification Hub",
        pitch1Title: "🛡️ Ensure Data Integrity",
        pitch1Text: "Leverage our vast database to guarantee UUID uniqueness across your systems. Prevent collisions before they happen.",
        pitch2Title: "🔍 Verify Identifier Trustworthiness",
        pitch2Text: "Lookup UUIDs to confirm their origin and sequence. Maintain a reliable and verifiable data lineage.",
        pitch3Title: "📊 Scalable & Reliable Service",
        pitch3Text: "Built for enterprise needs, our platform offers robust, high-availability checks for all your identification requirements.",
        themeToggleTitle: "Switch to Deep Space"
    },
    leaked: {
        title: "Exposed UUID Database",
        pitch1Title: "⚠️ Access Compromised IDs",
        pitch1Text: "Browse the archives of leaked identifiers. Are your systems exposed? Check the database dump.",
        pitch2Title: "🔒 Verify Potential Breaches",
        pitch2Text: "Search for specific UUIDs known to be circulating in the digital underground. Knowledge is your first defense.",
        pitch3Title: "📉 Rapid Threat Assessment",
        pitch3Text: "Quickly scan through millions of compromised entries. Find matches and assess your exposure risk instantly.",
        themeToggleTitle: "Switch to Deep Space"
    },
    steampunk: {
        title: "The UUID Chronometer",
        pitch1Title: "⚙️ Explore the Mechanism",
        pitch1Text: "Chart the intricate gears of the 2^128 identifier universe. Every tick reveals a new possibility in the grand machine.",
        pitch2Title: "🔩 Calibrate Your Search",
        pitch2Text: "Fine-tune the Difference Engine to locate specific UUID cogs within the brass and copper pathways.",
        pitch3Title: "💨 Steam-Powered Velocity",
        pitch3Text: "Navigate the clockwork expanse with unparalleled speed. Virtualized rendering ensures smooth traversal.",
        themeToggleTitle: "Venture into the Ancient Forest"
    },
    ancient_forest: {
        title: "Whispers of the UUID Grove",
        pitch1Title: "🌳 Discover Ancient IDs",
        pitch1Text: "Wander through the deep woods of 2^128 identifiers. Sunlight dapples through the canopy of possibilities.",
        pitch2Title: "🦋 Track Elusive Specimens",
        pitch2Text: "Follow the firefly trails to pinpoint specific UUIDs hidden beneath the moss and ferns.",
        pitch3Title: "🌿 Naturally Swift Navigation",
        pitch3Text: "Effortlessly glide through the digital ecosystem. Optimized rendering mirrors the forest's quiet efficiency.",
        themeToggleTitle: "Return to Deep Space"
    },
    unhinged: {
        title: "UUID Reality Fracture",
        pitch1Title: "💥 Shatter the Index",
        pitch1Text: "Witness the collapse of order. 2^128 identifiers splintering reality. Can you find signal in the noise?",
        pitch2Title: "⚡️ Catch Corrupted Data",
        pitch2Text: "Hunt down glitched UUIDs phasing in and out of existence. Pin them before they destabilize the system.",
        pitch3Title: "🌪️ Warp-Speed Instability",
        pitch3Text: "Navigate the chaotic data storm at the edge of compute limits. Rendering artifacts are features, not bugs.",
        themeToggleTitle: "Restore Order (Deep Space)"
    }
};

// Helper to generate a random 128-bit BigInt
function getRandom128Bi() {
    const buffer = new Uint8Array(16); // 16 bytes = 128 bits
    crypto.getRandomValues(buffer);
    let randomBi = 0n;
    for (let i = 0; i < buffer.length; i++) {
        randomBi = (randomBi << 8n) + BigInt(buffer[i]);
    }
    return randomBi;
}

// Helper function for smooth manual scrolling
function animateScroll(element, to, duration, onFinish) {
    if (!element) return;
    const start = element.scrollTop;
    const change = to - start;
    let currentTime = 0;
    const increment = 20; // Animation step interval (ms)


    // Simple ease-in-out function (quadratic)
    const easeInOutQuad = (t, b, c, d) => {
        t /= d / 2;
        if (t < 1) return c / 2 * t * t + b;
        t--;
        return -c / 2 * (t * (t - 2) - 1) + b;
    };

    const animate = () => {
        currentTime += increment;
        const val = easeInOutQuad(currentTime, start, change, duration);
        element.scrollTop = val;

        if (currentTime < duration) {
            setTimeout(animate, increment);
        } else {
            element.scrollTop = to; // Ensure final position is exact
            if (onFinish) onFinish();
        }
    };

    animate();
}

function App() {
    // --- State --- 
    const [theme, setTheme] = useState(() => {
        // Check URL for theme parameter first
        const params = new URLSearchParams(window.location.search);
        const urlTheme = params.get('theme');
        const validThemes = ['space', 'cyberpunk', 'saas', 'leaked', 'steampunk', 'ancient_forest', 'unhinged'];

        if (urlTheme && validThemes.includes(urlTheme)) {
            return urlTheme;
        }

        // Fallback to random theme selection if no valid param
        const randomIndex = Math.floor(Math.random() * validThemes.length);
        return validThemes[randomIndex]; 
    }); // Load theme from localStorage or default
    const [focusedLocationId, setFocusedLocationId] = useState(() => {
        // Initialize from URL or default (e.g., 0n)
        const params = new URLSearchParams(window.location.search);
        const q = params.get('q');
        try {
            const initialFocus = q ? decodeBase62(q) : 0n;
            return initialFocus;
        } catch (e) {
            console.error("Error decoding 'q' param:", e);
            return 0n;
        }
    });
    // State to track the *visually* highlighted item
    const [highlightedLocationId, setHighlightedLocationId] = useState(focusedLocationId);
    // Flag to trigger a random jump on initial load if 'q' is missing
    const [isInitialRandomJumpNeeded, setIsInitialRandomJumpNeeded] = useState(() => 
        !new URLSearchParams(window.location.search).get('q')
    );

    const [locationIds, setLocationIds] = useState([]);
    const isScrollingToTarget = useRef(false); // Flag to prevent fetchMore during programmatic scroll
    const isInitializing = useRef(true); // Flag for initial setup

    // --- Effects --- 

    // Apply theme attribute to the root element
    useEffect(() => {
        document.documentElement.setAttribute('data-theme', theme);
        // localStorage.setItem('appTheme', theme); // Remove saving to localStorage
    }, [theme]);

    // Generate the initial window OR regenerate on explicit navigation (popstate/initial load)
    useEffect(() => {
        if (isScrollingToTarget.current) {
            return;
        }

        const startId = focusedLocationId - BigInt(HALF_WINDOW);
        const newIds = Array.from({ length: INITIAL_WINDOW_SIZE }, (_, i) => {
            let id = startId + BigInt(i);
            // Wrap around if necessary (though BigInt doesn't overflow)
            if (id < 0n) id = MAX_UUID_VAL + id + 1n;
            if (id > MAX_UUID_VAL) id = id - MAX_UUID_VAL - 1n;
            return id;
        });
        setLocationIds(newIds);
        // Sync highlight with focus when list regenerates based on focus
        setHighlightedLocationId(focusedLocationId); 
        isInitializing.current = true; // Set flag for initial scroll setup
        console.log("List generated, isInitializing=true");
    }, [focusedLocationId]); // Re-run only when the *target* focused ID changes (search/URL)

    const parentRef = React.useRef()

    const rowVirtualizer = useVirtualizer({
        count: locationIds.length,
        getScrollElement: () => parentRef.current,
        estimateSize: () => ESTIMATED_ITEM_HEIGHT, // Provide estimate even for fixed size
        size: ESTIMATED_ITEM_HEIGHT, // Use fixed size
        overscan: 50, // Increase overscan for smoother visual effects
    });

    // Use useLayoutEffect to run after DOM mutations but before paint
    useLayoutEffect(() => {
        // Only run this effect if initializing and the list has items
        if (isInitializing.current && locationIds.length > 0 && parentRef.current) {
            const targetIndex = locationIds.findIndex(id => id === focusedLocationId);
            
            if (targetIndex !== -1) {
                console.log(`Initial centering (LayoutEffect): Found target index ${targetIndex}. Scrolling directly.`);

                // Log container dimensions and target index before scrolling
                const scrollElement = parentRef.current;
                const scrollHeight = scrollElement.scrollHeight;
                const offsetHeight = scrollElement.offsetHeight;
                const targetOffset = rowVirtualizer.measureElement(scrollElement.querySelector(`[data-index="${targetIndex}"]`))?.start ?? targetIndex * ESTIMATED_ITEM_HEIGHT; // Get measured offset or estimate
                const centeredOffset = targetOffset - (offsetHeight / 2) + (ESTIMATED_ITEM_HEIGHT / 2); // Estimate center position

                console.log(`  - Scroll Height: ${scrollHeight}`);
                console.log(`  - Offset Height: ${offsetHeight}`);
                console.log(`  - Estimated Target Offset: ${targetOffset}`);
                console.log(`  - Calculated Centered ScrollTop: ${centeredOffset}`);
                console.log(`  - Attempting scrollToIndex(${targetIndex}, { align: 'center', behavior: 'auto' })`);

                // Scroll directly without extra timers
                rowVirtualizer.scrollToIndex(targetIndex, { align: 'center', behavior: 'auto' });

                // Reset flags *after* the instant scroll call
                isInitializing.current = false;
                isScrollingToTarget.current = false; 
                console.log("Initial centering (LayoutEffect): Flags reset after direct scroll call.");

            } else {
                 // If target not found (edge case?), still reset flags immediately
                 console.warn("Initial centering (LayoutEffect): Target index not found, resetting flags.");
                 isInitializing.current = false;
                 isScrollingToTarget.current = false;
             }
        } else if (!parentRef.current && isInitializing.current && locationIds.length > 0) {
            console.warn("Initial centering (LayoutEffect): parentRef.current is null when attempting scroll.");
            // Maybe reset flags here too if ref is missing?
            // isInitializing.current = false;
            // isScrollingToTarget.current = false;
        }
    }, [locationIds, focusedLocationId, rowVirtualizer]);

    // --- Infinite Loading Logic ---
    const fetchMore = useCallback((direction) => {
        if (isScrollingToTarget.current || isInitializing.current) {
            return; // Don't fetch while programmatically scrolling or initializing
        }

        if (direction === 'down') {
            const lastId = locationIds[locationIds.length - 1];
            const nextIds = Array.from({ length: LOAD_AMOUNT }, (_, i) => {
                 let id = lastId + 1n + BigInt(i);
                 if (id > MAX_UUID_VAL) id = id - MAX_UUID_VAL - 1n;
                 return id;
            });
            setLocationIds(prev => [...prev, ...nextIds]);
        } else { // direction === 'up'
            const firstId = locationIds[0];
            const prevIds = Array.from({ length: LOAD_AMOUNT }, (_, i) => {
                let id = firstId - 1n - BigInt(LOAD_AMOUNT - 1 - i);
                if (id < 0n) id = MAX_UUID_VAL + id + 1n;
                return id;
            });

            // Estimate height adjustment before prepending
            const prependedHeight = LOAD_AMOUNT * ESTIMATED_ITEM_HEIGHT;

            setLocationIds(prev => [...prevIds, ...prev]);

            requestAnimationFrame(() => {
                if (parentRef.current) {
                    parentRef.current.scrollTop += prependedHeight;
                }
            });
        }
    }, [locationIds]); // Dependency: locationIds

    // Effect to check scroll position and trigger fetchMore
    useEffect(() => {
        const virtualItems = rowVirtualizer.getVirtualItems();
        if (!virtualItems || virtualItems.length === 0 || locationIds.length === 0 || isScrollingToTarget.current || isInitializing.current) {
            return;
        }

        const firstVisibleIndex = virtualItems[0].index;
        const lastVisibleIndex = virtualItems[virtualItems.length - 1].index;

        // Check for scrolling down
        if (lastVisibleIndex >= locationIds.length - 1 - LOAD_BUFFER) {
            fetchMore('down');
        }

        // Check for scrolling up
        if (firstVisibleIndex <= LOAD_BUFFER) {
            fetchMore('up');
        }
    }, [rowVirtualizer.getVirtualItems(), locationIds, fetchMore]);

    // --- URL State Management ---
    useEffect(() => {
        const handlePopState = () => {
            const params = new URLSearchParams(window.location.search);
            const q = params.get('q');
            let newLocationId = 0n;
            try {
                 newLocationId = q ? decodeBase62(q) : 0n;
            } catch (e) {
                console.error("Failed to decode URL parameter on popstate:", e);
                 newLocationId = 0n; // Fallback to 0
                history.replaceState(null, '', `?q=${encodeBase62(0n)}`);
            }
            setFocusedLocationId(newLocationId); // Update logical focus
            setHighlightedLocationId(newLocationId); // Update visual highlight
        };

        window.addEventListener('popstate', handlePopState);
        return () => window.removeEventListener('popstate', handlePopState);
    }, []); // Empty dependency array: setup listener once

    // Update URL when focusedLocationId changes *from user action* (like search)
    // The initial load/popstate useEffect handles setting state from URL.
    // This effect pushes state *to* the URL.
    const updateUrl = (newLocationId) => {
        const currentQ = new URLSearchParams(window.location.search).get('q');
        const newQ = encodeBase62(newLocationId);
        
        // Get the current theme to preserve it
        const currentTheme = theme; // Read from state

        if (newQ !== currentQ) {
            const params = new URLSearchParams();
            params.set('q', newQ);
            // Always include the current theme parameter
            if (currentTheme) {
                params.set('theme', currentTheme);
            }
            history.pushState({ locationId: newLocationId.toString() }, '', `?${params.toString()}`);
        }
    }

    // --- Search Handling ---
    const handleSearch = useCallback((query) => { // query can be string (UUID) or BigInt (locationId)
        let targetLocationId;
        let isDirectLocationId = typeof query === 'bigint';

        if (isDirectLocationId) {
            targetLocationId = query;
            console.log(`Direct locationId search/click: ${targetLocationId}`);
        } else {
            // Input is likely a UUID string from the search box
            const uuidString = query;
            const searchUUIDBigInt = parseUUIDtoBigInt(uuidString);
            if (searchUUIDBigInt === null) { alert("Invalid UUID format."); return; }
            targetLocationId = findLocationFromUUID(searchUUIDBigInt);
            console.log(`Search box query "${uuidString}" -> target locationId: ${targetLocationId}`);
        }

        if (isScrollingToTarget.current) { return; }

        // --- Optimization: Check if target is already loaded ---
        const existingIndex = locationIds.findIndex(id => id === targetLocationId);
        if (existingIndex !== -1) {
            console.log(`Target ${targetLocationId} found in loaded list at index ${existingIndex}. Scrolling to existing item.`);
            isScrollingToTarget.current = true;
            
            // Update focus and URL regardless of input type (search or click)
            setFocusedLocationId(targetLocationId);
            setHighlightedLocationId(targetLocationId); // Always update highlight
            updateUrl(targetLocationId); // Update URL

            // Calculate scroll position for existing item
             if (!parentRef.current) return;
             const containerHeight = parentRef.current.offsetHeight;
             const targetY = existingIndex * ESTIMATED_ITEM_HEIGHT;
             let targetScrollTop = targetY - (containerHeight / 2) + (ESTIMATED_ITEM_HEIGHT / 2);
             const maxScrollTop = parentRef.current.scrollHeight - containerHeight;
             targetScrollTop = Math.max(0, Math.min(targetScrollTop, maxScrollTop));

             const scrollAnimationTime = 800; // Shorter duration for existing items?

             animateScroll(parentRef.current, targetScrollTop, scrollAnimationTime, () => {
                 isScrollingToTarget.current = false;
                 isInitializing.current = false;
             });
             return; // Skip the replacement logic
        }
        // --- End Optimization ---

        // If not found, proceed with off-screen replacement
        const virtualItems = rowVirtualizer.getVirtualItems();
        if (!virtualItems || virtualItems.length === 0) {
            // Fallback if virtualItems aren't ready yet
            setFocusedLocationId(targetLocationId);
            setHighlightedLocationId(targetLocationId);
            updateUrl(targetLocationId); // Update URL here too
            isInitializing.current = true;
            return;
        }
        console.log("Initiating navigation via off-screen replace & manual scroll...");

        // --- Off-screen replacement logic ---
        const currentListSize = locationIds.length;
        const firstRendered = virtualItems[0].index;
        const lastRendered = virtualItems[virtualItems.length - 1].index;
        const zone1EndIndex = INSERT_WINDOW_SIZE - 1;
        const zone2StartIndex = currentListSize - INSERT_WINDOW_SIZE;
        const isZone1Safe = zone1EndIndex < firstRendered;
        const isZone2Safe = zone2StartIndex > lastRendered;
        let targetZone = null;
        const currentMidPointEstimate = highlightedLocationId;
        const direction = targetLocationId > currentMidPointEstimate ? 'down' : 'up';

        if (direction === 'up' && isZone1Safe) {
            targetZone = 1;
        } else if (direction === 'down' && isZone2Safe) {
            targetZone = 2;
        } else if (isZone1Safe) {
            targetZone = 1;
        } else if (isZone2Safe) {
            targetZone = 2;
        } else {
            console.error("Neither replacement zone is safe (outside rendered range). Aborting replace & scroll.");
            setFocusedLocationId(targetLocationId);
            setHighlightedLocationId(targetLocationId);
            updateUrl(targetLocationId); // Update URL here too
            isInitializing.current = true;
            return;
        }

        const insertStartId = targetLocationId - BigInt(HALF_INSERT_WINDOW);
        const newIdsToInsert = Array.from({ length: INSERT_WINDOW_SIZE }, (_, i) => {
            let id = insertStartId + BigInt(i);
            if (id < 0n) id = MAX_UUID_VAL + id + 1n;
            if (id > MAX_UUID_VAL) id = id - MAX_UUID_VAL - 1n;
            return id;
        });

        let temporaryLocationIds = [...locationIds];
        let targetIndexInList;
        if (targetZone === 1) {
            temporaryLocationIds.splice(0, INSERT_WINDOW_SIZE, ...newIdsToInsert);
            targetIndexInList = HALF_INSERT_WINDOW;
        } else {
            temporaryLocationIds.splice(zone2StartIndex, INSERT_WINDOW_SIZE, ...newIdsToInsert);
            targetIndexInList = zone2StartIndex + HALF_INSERT_WINDOW;
        }

        if (targetIndexInList < 0 || targetIndexInList >= temporaryLocationIds.length || temporaryLocationIds[targetIndexInList] !== targetLocationId) {
             targetIndexInList = temporaryLocationIds.findIndex(id => id === targetLocationId);
             if (targetIndexInList === -1) {
                  console.error("FATAL: targetLocationId not found after splice...");
                  setFocusedLocationId(targetLocationId);
                  setHighlightedLocationId(targetLocationId);
                  updateUrl(targetLocationId); // Update URL here too
                  isInitializing.current = true;
                  return;
             }
         }

        // 4. Set flag, Update state, Update URL
        isScrollingToTarget.current = true;
        setFocusedLocationId(targetLocationId); // Update logical focus
        setHighlightedLocationId(targetLocationId); // Update visual highlight
        updateUrl(targetLocationId); // Update URL here too
        setLocationIds(temporaryLocationIds);

        // 5. Initiate Manual Scroll for replaced section
        requestAnimationFrame(() => {
             if (!parentRef.current) return;
             const containerHeight = parentRef.current.offsetHeight;
             const targetY = targetIndexInList * ESTIMATED_ITEM_HEIGHT;
             let targetScrollTop = targetY - (containerHeight / 2) + (ESTIMATED_ITEM_HEIGHT / 2);
             const maxScrollTop = parentRef.current.scrollHeight - containerHeight;
             targetScrollTop = Math.max(0, Math.min(targetScrollTop, maxScrollTop));
             const scrollAnimationTime = 1200;

             animateScroll(parentRef.current, targetScrollTop, scrollAnimationTime, () => {
                 isScrollingToTarget.current = false;
                 isInitializing.current = false;
             });
        });
    }, [locationIds, highlightedLocationId, rowVirtualizer]);

    // --- Random Navigation ---
    const INSERT_WINDOW_SIZE = 21; // Ensure this is defined before handleSearch if used there
    const HALF_INSERT_WINDOW = Math.floor(INSERT_WINDOW_SIZE / 2);

     const handleRandom = useCallback(() => {
         if (isScrollingToTarget.current) { return; }

         const randomLocationId = getRandom128Bi();

        // --- Optimization: Check if target is already loaded ---
        const existingIndex = locationIds.findIndex(id => id === randomLocationId);
        if (existingIndex !== -1) {
            console.log(`Random: Target ${randomLocationId} found in loaded list. Scrolling.`);
            isScrollingToTarget.current = true;
            setFocusedLocationId(randomLocationId);
            setHighlightedLocationId(randomLocationId);
            updateUrl(randomLocationId);

            // Calculate scroll position for existing item
            if (!parentRef.current) return;
            const containerHeight = parentRef.current.offsetHeight;
            const targetY = existingIndex * ESTIMATED_ITEM_HEIGHT;
            let targetScrollTop = targetY - (containerHeight / 2) + (ESTIMATED_ITEM_HEIGHT / 2);
            const maxScrollTop = parentRef.current.scrollHeight - containerHeight;
            targetScrollTop = Math.max(0, Math.min(targetScrollTop, maxScrollTop));

            const scrollAnimationTime = 800; // Shorter duration for existing items?

            animateScroll(parentRef.current, targetScrollTop, scrollAnimationTime, () => {
                isScrollingToTarget.current = false;
                isInitializing.current = false;
            });
            return; // Skip the replacement logic
        }
        // --- End Optimization ---

        // If not found, proceed with off-screen replacement
         const virtualItems = rowVirtualizer.getVirtualItems();
         if (!virtualItems || virtualItems.length === 0) { return; }

         const currentListSize = locationIds.length;

         // --- Off-screen replacement logic (remains the same) ---
         const firstRendered = virtualItems[0].index;
         const lastRendered = virtualItems[virtualItems.length - 1].index;
         const zone1EndIndex = INSERT_WINDOW_SIZE - 1;
         const zone2StartIndex = currentListSize - INSERT_WINDOW_SIZE;
         const isZone1Safe = zone1EndIndex < firstRendered;
         const isZone2Safe = zone2StartIndex > lastRendered;
         let targetZone = null;
         const currentMidPointEstimate = focusedLocationId;
         const direction = randomLocationId > currentMidPointEstimate ? 'down' : 'up';

         if (direction === 'up' && isZone1Safe) {
             targetZone = 1;
         } else if (direction === 'down' && isZone2Safe) {
             targetZone = 2;
         } else if (isZone1Safe) {
             targetZone = 1;
         } else if (isZone2Safe) {
             targetZone = 2;
         } else {
             console.error("Random: Neither replacement zone is safe...");
             return;
         }

         const insertStartId = randomLocationId - BigInt(HALF_INSERT_WINDOW);
         const newIdsToInsert = Array.from({ length: INSERT_WINDOW_SIZE }, (_, i) => {
             let id = insertStartId + BigInt(i);
             if (id < 0n) id = MAX_UUID_VAL + id + 1n;
             if (id > MAX_UUID_VAL) id = id - MAX_UUID_VAL - 1n;
             return id;
         });

         let temporaryLocationIds = [...locationIds];
         let targetIndexInList;
         if (targetZone === 1) {
             temporaryLocationIds.splice(0, INSERT_WINDOW_SIZE, ...newIdsToInsert);
             targetIndexInList = HALF_INSERT_WINDOW;
         } else {
             temporaryLocationIds.splice(zone2StartIndex, INSERT_WINDOW_SIZE, ...newIdsToInsert);
             targetIndexInList = zone2StartIndex + HALF_INSERT_WINDOW;
         }

         if (targetIndexInList < 0 || targetIndexInList >= temporaryLocationIds.length || temporaryLocationIds[targetIndexInList] !== randomLocationId) {
             console.warn(`Random: Index mismatch... Recalculating.`);
             targetIndexInList = temporaryLocationIds.findIndex(id => id === randomLocationId);
             if (targetIndexInList === -1) {
                  console.error("FATAL: randomLocationId not found...");
                  return;
             }
         }

         // 4. Set flag, Update state (NOW includes focus/URL)
         isScrollingToTarget.current = true;
         setFocusedLocationId(randomLocationId);
         setHighlightedLocationId(randomLocationId);
         updateUrl(randomLocationId);
         setLocationIds(temporaryLocationIds);

         // 5. Initiate Manual Scroll for replaced section
         requestAnimationFrame(() => {
             if (!parentRef.current) return;
             const containerHeight = parentRef.current.offsetHeight;
             const targetY = targetIndexInList * ESTIMATED_ITEM_HEIGHT;
             let targetScrollTop = targetY - (containerHeight / 2) + (ESTIMATED_ITEM_HEIGHT / 2);
             const maxScrollTop = parentRef.current.scrollHeight - containerHeight;
             targetScrollTop = Math.max(0, Math.min(targetScrollTop, maxScrollTop));
             const scrollAnimationTime = 1200;

             animateScroll(parentRef.current, targetScrollTop, scrollAnimationTime, () => {
                 isScrollingToTarget.current = false;
                 isInitializing.current = false;
             });
         });
     }, [locationIds, focusedLocationId, rowVirtualizer]);

    // Effect to trigger initial random jump if no 'q' param was present
    useEffect(() => {
        // Only run if the jump is needed, list has items, and not already scrolling/initializing
        // Add extra check for rowVirtualizer to prevent race conditions
        if (isInitialRandomJumpNeeded && locationIds.length > 0 && !isScrollingToTarget.current && !isInitializing.current && parentRef.current && rowVirtualizer) {
            // Small delay to ensure initial centering layout effect finishes
            const timeoutId = setTimeout(() => {
                // Re-check conditions inside timeout
                if (isInitialRandomJumpNeeded && !isScrollingToTarget.current && !isInitializing.current) {
                    console.log("Initial load without 'q' param, triggering random jump...");
                    handleRandom(); // Call the existing random handler
                    setIsInitialRandomJumpNeeded(false); // Ensure it only runs once
                }
            }, 100); // Small delay (e.g., 100ms)

            return () => clearTimeout(timeoutId); // Cleanup timeout on unmount/re-run
        }
        // Dependencies: flag, list readiness, random handler function, virtualizer instance
    }, [isInitialRandomJumpNeeded, locationIds, handleRandom, rowVirtualizer]);

    // --- Handlers --- 

    const handleThemeToggle = useCallback(() => {
        setTheme(prevTheme => {
            let nextTheme;
            if (prevTheme === 'space') nextTheme = 'cyberpunk';
            else if (prevTheme === 'cyberpunk') nextTheme = 'saas';
            else if (prevTheme === 'saas') nextTheme = 'leaked';
            else if (prevTheme === 'leaked') nextTheme = 'steampunk'; 
            else if (prevTheme === 'steampunk') nextTheme = 'ancient_forest'; 
            else if (prevTheme === 'ancient_forest') nextTheme = 'unhinged';
            else nextTheme = 'space'; // Unhinged -> Space

            // Update URL parameter
            const params = new URLSearchParams(window.location.search);
            params.set('theme', nextTheme);
            // Preserve existing 'q' parameter if present
            const qParam = new URLSearchParams(window.location.search).get('q');
            if (qParam) {
                 params.set('q', qParam);
            }
            history.pushState(null, '', `?${params.toString()}`);

            return nextTheme;
        });
    }, []);

    // --- Derived State ---
    const currentContent = themeContent[theme] || themeContent.space; // Fallback to space theme

    // --- Render --- 
    return (
        <div className="app-container">
            <h1>{currentContent.title}</h1>

            {/* Controls Container */}
            <div className="controls-container">
                <SearchBox onSearch={handleSearch} />
                <button onClick={handleRandom} className="random-button">Random</button>
            </div>

            {/* Virtualized List */}
             <div className="list-container" ref={parentRef}>
                 <div
                    style={{
                      height: `${rowVirtualizer.getTotalSize()}px`,
                      width: '100%',
                      position: 'relative',
                    }}
                  >
                    {rowVirtualizer.getVirtualItems().map((virtualItem) => {
                        // Get the sequential locationId for this item's index
                        const itemLocationId = locationIds[virtualItem.index];
                        // Check focus based on the *highlighted* locationId
                        const isHighlighted = itemLocationId === highlightedLocationId;

                        // Safety check
                        if (itemLocationId === undefined) {
                             console.error(`[Render] Undefined locationId at index ${virtualItem.index}`);
                             return null; // Skip rendering this item
                        }

                        // 1. Derive the permuted value from locationId
                        const permutedUUID = deriveUUIDFromLocation(itemLocationId);
                        // 2. Force V4 bits onto the permuted value
                        const displayUUID = forceV4Bits(permutedUUID);
                        // 3. Format the V4-compatible BigInt for display
                        const formattedUUID = formatBigIntAsUUID(displayUUID);

                        return (
                            <div
                                key={itemLocationId.toString()} // Key is the unique sequential locationId
                                data-index={virtualItem.index}
                                className={`list-item ${isHighlighted ? 'focused' : ''}`} // Use isHighlighted for class
                                style={{
                                    position: 'absolute',
                                    top: 0,
                                    left: 0,
                                    width: '100%',
                                    height: `${virtualItem.size}px`,
                                    transform: `translateY(${virtualItem.start}px)`,
                                    // Removed inline border/display styles, handled by CSS
                                }}
                                onClick={() => handleSearch(itemLocationId)}
                            >
                                <span>{formattedUUID}</span>
                            </div>
                        );
                     })}
                 </div>
             </div>

            {/* Sales Pitch Cards Container */}
            <div className="pitch-container">
                <div className="pitch-card">
                    <h3>{currentContent.pitch1Title}</h3>
                    <p>{currentContent.pitch1Text}</p>
                </div>
                <div className="pitch-card">
                    <h3>{currentContent.pitch2Title}</h3>
                    <p>{currentContent.pitch2Text}</p>
                </div>
                 <div className="pitch-card">
                    <h3>{currentContent.pitch3Title}</h3>
                    <p>{currentContent.pitch3Text}</p>
                </div>
            </div>

            {/* Corner Theme Toggle Button ADDED here */}
            <button 
                onClick={handleThemeToggle} 
                title={currentContent.themeToggleTitle}
                className="theme-toggle-corner"
            >
                🎨 {/* Using an emoji as a simple icon */}
            </button>
        </div>
    );
}

export default App;
