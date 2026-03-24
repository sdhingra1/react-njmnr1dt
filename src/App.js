import React, { useState, useEffect, useMemo, useRef } from 'react';
import { 
  Search, 
  Menu, 
  X, 
  BookOpen, 
  Moon, 
  Sun,
  Heart,
  Trash2,
  Mic,
  Square,
  Languages,
  AlertCircle,
  Cloud,
  Save,
  Star,
  Edit,
  Sparkles,
  Loader2,
  ChevronUp,
  ChevronDown
} from 'lucide-react';

import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously, onAuthStateChanged } from 'firebase/auth';
import { getFirestore, collection, doc, setDoc, deleteDoc, updateDoc, onSnapshot, arrayUnion } from 'firebase/firestore';

// --------------------------------------------------------
// USER'S FIREBASE CONFIGURATION
// --------------------------------------------------------
const myFirebaseConfig = {
  apiKey: "AIzaSyB_YSnEhbgGqK5LZ2VC-_6bQu-cKPlNjVY",
  authDomain: "mera-sach.firebaseapp.com",
  projectId: "mera-sach",
  storageBucket: "mera-sach.firebasestorage.app",
  messagingSenderId: "864665992583",
  appId: "1:864665992583:web:e24325b595fc791a7e2722",
  measurementId: "G-QD896X6NE7"
};

// Initialize Firebase
let app, auth, db, appId = "mera-sach-public-app";
try {
  if (myFirebaseConfig && myFirebaseConfig.apiKey) {
    app = initializeApp(myFirebaseConfig);
    auth = getAuth(app);
    db = getFirestore(app);
  }
} catch (e) {
  console.error("Firebase config missing or invalid", e);
}

// Fallback ID generator if Firebase Auth is disabled
const getLocalUid = () => {
  try {
    let uid = localStorage.getItem('mera_sach_uid');
    if (!uid) {
      uid = 'anon_' + Math.random().toString(36).substring(2, 15);
      localStorage.setItem('mera_sach_uid', uid);
    }
    return uid;
  } catch (e) {
    return 'anon_temp_id';
  }
};

// --------------------------------------------------------
// LOCAL DATABASE (IndexedDB) FOR GUARANTEED PERMANENCE
// --------------------------------------------------------
const DB_NAME = 'MeraSachAudioDB';
const STORE_NAME = 'audio_recordings';

const initDB = () => {
  return new Promise((resolve, reject) => {
    if (!window.indexedDB) return resolve(null);
    const request = window.indexedDB.open(DB_NAME, 1);
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
    request.onupgradeneeded = (e) => {
      e.target.result.createObjectStore(STORE_NAME);
    };
  });
};

const saveAudioDB = async (poemId, base64data, mimeType) => {
  const database = await initDB();
  if(!database) return;
  return new Promise((resolve, reject) => {
    const tx = database.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    const request = store.put({ audioBase64: base64data, mimeType }, String(poemId));
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
};

const getAllAudioDB = async () => {
  const database = await initDB();
  if(!database) return {};
  return new Promise((resolve, reject) => {
    const tx = database.transaction(STORE_NAME, 'readonly');
    const store = tx.objectStore(STORE_NAME);
    const request = store.getAll();
    const keysRequest = store.getAllKeys();

    request.onsuccess = () => {
      keysRequest.onsuccess = () => {
        const result = {};
        keysRequest.result.forEach((key, i) => {
          result[key] = request.result[i];
        });
        resolve(result);
      };
    };
    request.onerror = () => reject(request.error);
  });
};

const deleteAudioDB = async (poemId) => {
  const database = await initDB();
  if(!database) return;
  return new Promise((resolve, reject) => {
    const tx = database.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    const request = store.delete(String(poemId));
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
};

// --------------------------------------------------------
// GRAPHICS & CONTENT
// --------------------------------------------------------

// Simple artistic line border with a clean white background
const ArtisticLineBorder = ({ darkMode }) => {
  const lineColor = darkMode ? '#475569' : '#cbd5e1'; // Solid Grey border

  return (
    <div className="absolute inset-0 pointer-events-none z-10 p-5">
      <div 
        className="w-full h-full rounded-[24px]"
        style={{ border: `2px solid ${lineColor}` }} // 1 thick solid line
      >
      </div>
    </div>
  );
};


const PoemGraphic = ({ theme, darkMode }) => {
  const strokeColor = darkMode ? '#475569' : '#cbd5e1'; 
  const highlightColor = darkMode ? '#ef4444' : '#f87171';
  const leafColor = darkMode ? '#10b981' : '#34d399'; 

  const graphics = {
    barren: (
      <svg viewBox="0 0 400 200" className="w-full h-full opacity-30">
        <path d="M50,150 L350,150" stroke={strokeColor} strokeWidth="1" />
        <path d="M80,150 L75,135 M120,150 L125,140 M200,150 L195,130 M280,150 L285,138" stroke={strokeColor} strokeWidth="1" />
        <path d="M180,130 Q200,90 220,130" fill="none" stroke={highlightColor} strokeWidth="1" opacity="0.4" />
        <path d="M190,125 Q200,105 210,125" fill="none" stroke={highlightColor} strokeWidth="1" opacity="0.6" />
        <circle cx="200" cy="150" r="60" fill={`url(#grad-barren-${darkMode})`} opacity="0.1" />
        <defs>
          <radialGradient id={`grad-barren-${darkMode}`}>
            <stop offset="0%" stopColor={highlightColor} />
            <stop offset="100%" stopColor="transparent" />
          </radialGradient>
        </defs>
      </svg>
    ),
    tomb: (
      <svg viewBox="0 0 400 200" className="w-full h-full opacity-30">
        <path d="M150,150 L250,150 M160,150 L160,110 Q160,80 200,80 Q240,80 240,110 L240,150" fill="none" stroke={strokeColor} strokeWidth="1.5" />
        <rect x="185" y="120" width="30" height="30" rx="1" fill="none" stroke={strokeColor} strokeWidth="0.5" />
        <path d="M100,150 C130,150 140,130 160,130" stroke={strokeColor} strokeWidth="0.8" opacity="0.5" />
        <circle cx="200" cy="100" r="3" fill={highlightColor} opacity="0.4" />
      </svg>
    ),
    lake: (
      <svg viewBox="0 0 400 200" className="w-full h-full opacity-30">
        <path d="M100,110 Q200,90 300,110" fill="none" stroke={strokeColor} strokeWidth="1" opacity="0.3" />
        <path d="M80,125 Q200,105 320,125" fill="none" stroke={strokeColor} strokeWidth="1" opacity="0.5" />
        <path d="M120,140 Q200,120 280,140" fill="none" stroke={strokeColor} strokeWidth="1" opacity="0.3" />
        <path d="M180,90 C190,70 210,70 220,90 S240,110 250,90" fill="none" stroke={highlightColor} strokeWidth="1.5" opacity="0.4" />
      </svg>
    ),
    tree: (
      <svg viewBox="0 0 400 200" className="w-full h-full opacity-30">
        <path d="M200,160 L200,90 M200,130 L230,110 M200,120 L175,105" fill="none" stroke={strokeColor} strokeWidth="1.5" />
        <path d="M230,110 Q245,100 235,90 Q220,100 230,110" fill={leafColor} opacity="0.4" />
        <path d="M175,105 Q160,95 170,85 Q185,95 175,105" fill={leafColor} opacity="0.4" />
        <path d="M200,90 Q215,80 205,70 Q190,80 200,90" fill={leafColor} opacity="0.6" />
      </svg>
    ),
    tangle: (
      <svg viewBox="0 0 400 200" className="w-full h-full opacity-30">
        <path d="M150,110 C160,70 190,150 210,90 S250,130 200,130 S140,90 200,70 S260,150 200,150 S120,110 150,110" fill="none" stroke={strokeColor} strokeWidth="1.2" />
        <path d="M180,110 L220,110 M200,90 L200,130" stroke={highlightColor} strokeWidth="0.5" opacity="0.3" />
      </svg>
    ),
    ravan: (
      <svg viewBox="0 0 400 200" className="w-full h-full opacity-30">
        {[...Array(10)].map((_, i) => (
          <circle key={i} cx={110 + i * 20} cy={90 + Math.sin(i) * 5} r="2" fill={strokeColor} opacity="0.5" />
        ))}
        <path d="M180,140 Q200,90 220,140" fill="none" stroke={highlightColor} strokeWidth="1.5" opacity="0.5" />
        <path d="M190,135 L210,135" stroke={strokeColor} strokeWidth="0.5" />
      </svg>
    ),
    umbrella: (
      <svg viewBox="0 0 400 200" className="w-full h-full opacity-30">
        <path d="M170,120 Q200,80 230,120" fill="none" stroke={strokeColor} strokeWidth="2" />
        <path d="M200,120 L200,140 Q200,145 205,145" fill="none" stroke={strokeColor} strokeWidth="1.5" />
        <line x1="160" y1="70" x2="155" y2="90" stroke={highlightColor} strokeWidth="0.8" opacity="0.4" />
        <line x1="240" y1="60" x2="235" y2="80" stroke={highlightColor} strokeWidth="0.8" opacity="0.4" />
        <line x1="210" y1="90" x2="205" y2="110" stroke={highlightColor} strokeWidth="0.8" opacity="0.4" />
      </svg>
    ),
    city: (
      <svg viewBox="0 0 400 200" className="w-full h-full opacity-30">
        <path d="M100,150 L300,150" stroke={strokeColor} strokeWidth="1" />
        <path d="M150,150 L150,90 L140,90 L160,90" fill="none" stroke={strokeColor} strokeWidth="1.5" />
        <circle cx="150" cy="85" r="5" fill={highlightColor} opacity="0.3" />
        <path d="M250,150 L250,130" stroke={strokeColor} strokeWidth="1" />
        <rect x="245" y="125" width="10" height="5" fill="none" stroke={strokeColor} strokeWidth="0.5" />
      </svg>
    )
  };

  return <div className="w-full h-full">{graphics[theme] || graphics.barren}</div>;
};

const INITIAL_POEMS = [
  {
    title: "कोई लफ्ज़ आज जंचता ही नहीं",
    titleTrans: "Koi Lafz Aaj Janchta Hi Nahin",
    titleEn: "No Word Seems Right Today",
    content: "आग हल्की सी सुलगती है दिल की ज़मीं पर\nदिल खुश्क है जैसे किसी बंजर की तरह\nकोई अश्क आज ढ़लता ही नहीं\n\nकुछ जम सा गया है किसी कोने में दिल के\nकुछ बैठ गया है किसी पत्थर की तरह\nकोई दोस्त आज मिलता ही नहीं\n\nइक शेर है, नज़्म है या नगमा है कोई\nकुछ उलझा हुआ है किसी गुंजल की तरह\nकोई लफ्ज़ आज जंचता ही नहीं",
    contentTrans: "Aag halki si sulagti hai dil ki zameen par\nDil khushk hai jaise kisi banjar ki tarah\nKoi ashk aaj dhalta hi nahin\n\nKuchh jam sa gaya hai kisi kone mein dil ke\nKuchh baith gaya hai kisi patthar ki tarah\nKoi dost aaj milta hi nahin\n\nIk sher hai, nazm hai ya nagma hai koi\nKuchh uljha hua hai kisi gunjal ki tarah\nKoi lafz aaj janchta hi nahin",
    contentEn: "A faint fire smolders on the ground of the heart\nThe heart is dry, like a barren wasteland\nNot a single tear flows today\n\nSomething has frozen in a corner of the heart\nSomething has settled heavy like a stone\nNo friend is found today\n\nWhether it's a verse, a poem, or a song\nSomething is tangled like a messy knot\nNo word seems right today",
    tags: ["उदासी", "खामोशी"],
    artworkTheme: "barren"
  },
  {
    title: "आदत",
    titleTrans: "Aadat",
    titleEn: "Habit",
    content: "हर पुरानी गुफतगू को बारहा\nदिल ही दिल में\nफिर से दोहराने की आदत\n\nजहां अक्सर मिला करते थे हम\nउस पुराने मकबरे पर\nबेखुदी में अपने आप\nखुद उसी पत्थर के पास\nयक-ब-यक पाने की आदत\n\nमेरी राहतों में शुमार हैं\nआदतें ऐसी कई\nअच्छी-बुरी, छोटी-बड़ी\n\nतेरा साथ फिर जो नसीब हो\nऔर तू फिर से मेरे करीब हो\nतेरे तस्सव्वुर का ज़ायका\nयाद की वो लज्जतें\n\nयकीं दिलाती हैं मुझे\nरहेंगी मेरे साथ फिर भी\nवो अच्छी-ब्री, छोटी-बड़ी\nसारी पुरानी आदतें",
    contentTrans: "Har purani guftagoo ko baarha\nDil hi dil mein\nPhir se dohrane ki aadat\n\nJahan aksar mila karte the hum\nUs purane maqbare par\nBekhudi mein apne aap\nKhud usi patthar ke paas\nYak-ba-yak paane ki aadat\n\nMeri raahaton mein shumar hain\nAadatein aisi kai\nAchhi-buri, chhoti-badi\n\nTera saath phir jo naseeb ho\nAur tu phir se mere kareeb ho\nTere tassavvur ka zaayka\nYaad ki wo lazzatein\n\nYaqeen dilati hain mujhe\nRahengi mere saath phir bhi\nWo achhi-buri, chhoti-badi\nSaari purani aadatein",
    contentEn: "Every old conversation, repeatedly\nWithin the depths of the heart\nThe habit of repeating them again\n\nWhere we used to meet often\nAt that old tomb\nIn a state of self-oblivion\nSuddenly finding myself\nRight beside that same stone\n\nNumbered among my comforts\nAre many such habits\nGood or bad, small or large\n\nIf your companionship is destined again\nAnd you come close to me once more\nThe taste of your imagination\nThose pleasures of memory\n\nThey assure me\nThey will stay with me still\nThose good-bad, small-large\nAll the old habits",
    tags: ["यादें", "मोहब्बत"],
    artworkTheme: "tomb"
  },
  {
    title: "धीरे धीरे",
    titleTrans: "Dheere Dheere",
    titleEn: "Slowly",
    content: "उसने लिखी थी कहानी\nमेरे जिस्म पर धीरे धीरे\n\nगर्म साँसों की कलम से\nमेरे रूह पर धीरे धीरे\n\nइक झील सी महकाई थी\nमैं डूब गया धीरे धीरे\n\nहोंठों से छुआ दिल को\nमजबूर हुआ धीरे धीरे\n\nरंगीन बिसात नज़रों की\nबस हार गया धीरे धीरे",
    contentTrans: "Usne likhi thi kahani\nMere jism par dheere dheere\n\nGaram sanson ki kalam se\nMere rooh par dheere dheere\n\nIk jheel si mehkai thi\nMain doob gaya dheere dheere\n\nHothon se chhua dil ko\nMajboor hua dheere dheere\n\nRangeen bisaat nazron ki\nBas haar gaya dheere dheere",
    contentEn: "She wrote a story\nUpon my body, slowly\n\nWith the pen of warm breaths\nUpon my soul, slowly\n\nShe scented a lake-like aura\nI drowned in it, slowly\n\nTouched the heart with lips\nI became helpless, slowly\n\nThe colorful chessboard of glances\nI simply lost to them, slowly",
    tags: ["इश्क"],
    artworkTheme: "lake"
  },
  {
    title: "दर्द",
    titleTrans: "Dard",
    titleEn: "Pain",
    content: "दिल की ज़मीं पर तेरे दर्द का पेड़\nधीरे-धीरे कुछ और फैलता जाता है\nहर रात तैरी याद जब बरसती है\nहर पत्ता कुछ और हरा हो जाता है\n\nकुछ फूल भी खिलने लगे हैं आस पास\nमौसम कछ और बदलता जाता है\nतेरे दर्द की आदत का सहारा है तो\nजीना कुछ और आसान हुआ जाता है\n\nऔर कुछ और भी हैरानी है मुझे\nतेरे मिलने की तमन्ना, इंतज़ार तेरा\nअब भी बाकी है मगर, दर्द तेरा\nअब तुझ से भी अज़ीज़ हुआ जाता है",
    contentTrans: "Dil ki zameen par tere dard ka ped\nDheere-dheere kuchh aur phailta jaata hai\nHar raat teri yaad jab barasti hai\nHar patta kuchh aur hara ho jaata hai\n\nKuchh phool bhi khilne lage hain aas paas\nMausam kuchh aur badalta jaata hai\nTere dard ki aadat ka sahara hai toh\nJeena kuchh aur aasan hua jaata hai\n\nAur kuchh aur bhi hairani hai mujhe\nTere milne ki tamanna, intezaar tera\nAb bhi baaki hai magar, dard तेरा\nAb tujh se bhi azeez hua jaata hai",
    contentEn: "On the ground of my heart, the tree of your pain\nSlowly keeps spreading a little more\nEvery night when your memory rains\nEvery leaf becomes a little greener\n\nSome flowers have also begun to bloom nearby\nThe season keeps changing a little more\nWith the support of the habit of your pain\nLiving becomes a little easier\n\nAnd something else surprises me\nThe desire to meet you, the waiting for you\nIs still there, yet your pain\nIs becoming even dearer to me than you",
    tags: ["दर्द", "इंतज़ार"],
    artworkTheme: "tree"
  },
  {
    title: "ये साली ज़िंदगी ...",
    titleTrans: "Ye Saali Zindagi ...",
    titleEn: "This Wretched Life...",
    content: "ये साली ज़िंदगी ...\nबेतरतीब बंधी डोर की तरह\nउलझती सी रहती है\n\nहर वक़्त, हर तरफ, हर जगह\nकुछ ढूँढती सी रहती है\n\nशराब दोनों जहां की पी कर भी\nहर दम प्यासी रहती है\n
