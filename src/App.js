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
  ChevronDown,
  BookText,
  Download
} from 'lucide-react';

import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously, onAuthStateChanged } from 'firebase/auth';
import { getFirestore, collection, doc, setDoc, deleteDoc, updateDoc, onSnapshot, arrayUnion, getDoc } from 'firebase/firestore';

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

const uploadAudioToCloud = async (dbInstance, poemId, base64data, mimeType) => {
  const CHUNK_SIZE = 800000; // 800KB chunks to safely stay under Firestore 1MB limit
  const chunks = [];
  for (let i = 0; i < base64data.length; i += CHUNK_SIZE) {
    chunks.push(base64data.slice(i, i + CHUNK_SIZE));
  }
  
  for (let i = 0; i < chunks.length; i++) {
    await setDoc(doc(dbInstance, 'mera_sach_audio_chunks', `poem_${poemId}_${i}`), {
      data: chunks[i],
      poemId: String(poemId),
      chunkIndex: i
    });
  }
  
  await setDoc(doc(dbInstance, 'mera_sach_audio_meta', `poem_${poemId}`), {
    mimeType: mimeType,
    numChunks: chunks.length,
    updatedAt: Date.now()
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

const INITIAL_POEMS = [
  {
    title: "कोई लफ्ज़ आज जंचता ही नहीं",
    titleTrans: "Koi Lafz Aaj Janchta Hi Nahin",
    titleEn: "No Word Seems Right Today",
    content: "आग हल्की सी सुलगती है दिल की ज़मीं पर\nदिल खुश्क है जैसे किसी बंजर की तरह\nकोई अश्क आज ढ़लता ही नहीं\n\nकुछ जम सा गया है किसी कोने में दिल के\nकुछ बैठ गया है किसी पत्थर की तरह\nकोई दोस्त आज मिलता ही नहीं\n\nइक शेर है, नज़्म है या नगमा है कोई\nकुछ उलझा हुआ है किसी गुंजल की तरह\nकोई लफ्ज़ आज जंचता ही नहीं",
    contentTrans: "Aag halki si sulagti hai dil ki zameen par\nDil khushk hai jaise kisi banjar ki tarah\nKoi ashk aaj dhalta hi nahin\n\nKuchh jam sa gaya hai kisi kone mein dil ke\nKuchh baith gaya hai kisi patthar ki tarah\nKoi dost aaj milta hi nahin\n\nIk sher hai, nazm hai ya nagma hai koi\nKuchh uljha hua hai kisi gunjal ki tarah\nKoi lafz aaj janchta hi nahin",
    contentEn: "A faint fire smolders on the ground of the heart\nThe heart is dry, like a barren wasteland\nNot a single tear flows today\n\nSomething has frozen in a corner of the heart\nSomething has settled heavy like a stone\nNo friend is found today\n\nWhether it's a verse, a poem, or a song\nSomething is tangled like a messy knot\nNo word seems right today"
  },
  {
    title: "आदत",
    titleTrans: "Aadat",
    titleEn: "Habit",
    content: "हर पुरानी गुफतगू को बारहा\nदिल ही दिल में\nफिर से दोहराने की आदत\n\nजहां अक्सर मिला करते थे हम\nउस पुराने मकबरे पर\nबेखुदी में अपने आप\nखुद उसी पत्थर के पास\nयक-ब-यक पाने की आदत\n\nमेरी राहतों में शुमार हैं\nआदतें ऐसी कई\nअच्छी-बुरी, छोटी-बड़ी\n\nतेरा साथ फिर जो नसीब हो\nऔर तू फिर से मेरे करीब हो\nतेरे तस्सव्वुर का ज़ायका\nयाद की वो लज्जतें\n\nयकीं दिलाती हैं मुझे\nरहेंगी मेरे साथ फिर भी\nवो अच्छी-ब्री, छोटी-बड़ी\nसारी पुरानी आदतें",
    contentTrans: "Har purani guftagoo ko baarha\nDil hi dil mein\nPhir se dohrane ki aadat\n\nJahan aksar mila karte the hum\nUs purane maqbare par\nBekhudi mein apne aap\nKhud usi patthar ke paas\nYak-ba-yak paane ki aadat\n\nMeri raahaton mein shumar hain\nAadatein aisi kai\nAchhi-buri, chhoti-badi\n\nTera saath phir jo naseeb ho\nAur tu phir se mere kareeb ho\nTere tassavvur ka zaayka\nYaad ki wo lazzatein\n\nYaqeen dilati hain mujhe\nRahengi mere saath phir bhi\nWo achhi-buri, chhoti-badi\nSaari purani aadatein",
    contentEn: "Every old conversation, repeatedly\nWithin the depths of the heart\nThe habit of repeating them again\n\nWhere we used to meet often\nAt that old tomb\nIn a state of self-oblivion\nSuddenly finding myself\nRight beside that same stone\n\nNumbered among my comforts\nAre many such habits\nGood or bad, small or large\n\nIf your companionship is destined again\nAnd you come close to me once more\nThe taste of your imagination\nThose pleasures of memory\n\nThey assure me\nThey will stay with me still\nThose good-bad, small-large\nAll the old habits"
  },
  {
    title: "धीरे धीरे",
    titleTrans: "Dheere Dheere",
    titleEn: "Slowly",
    content: "उसने लिखी थी कहानी\nमेरे जिस्म पर धीरे धीरे\n\nगर्म साँसों की कलम से\nमेरे रूह पर धीरे धीरे\n\nइक झील सी महकाई थी\nमैं डूब गया धीरे धीरे\n\nहोंठों से छुआ दिल को\nमजबूर हुआ धीरे धीरे\n\nरंगीन बिसात नज़रों की\nबस हार गया धीरे धीरे",
    contentTrans: "Usne likhi thi kahani\nMere jism par dheere dheere\n\nGaram sanson ki kalam se\nMere rooh par dheere line\n\nIk jheel si mehkai thi\nMain doob gaya dheere dheere\n\nHothon se chhua dil ko\nMajboor hua dheere dheere\n\nRangeen bisaat nazron ki\nBas haar gaya dheere dheere",
    contentEn: "She wrote a story\nUpon my body, slowly\n\nWith the pen of warm breaths\nUpon my soul, slowly\n\nShe scented a lake-like aura\nI drowned in it, slowly\n\nTouched the heart with lips\nI became helpless, slowly\n\nThe colorful chessboard of glances\nI simply lost to them, slowly"
  },
  {
    title: "दर्द",
    titleTrans: "Dard",
    titleEn: "Pain",
    content: "दिल की ज़मीं पर तेरे दर्द का पेड़\nधीरे-धीरे कुछ और फैलता जाता है\nहर रात तैरी याद जब बरसती है\nहर पत्ता कुछ और हरा हो जाता है\n\nकुछ फूल भी खिलने लगे हैं आस पास\nमौसम कछ और बदलता जाता है\nतेरे दर्द की आदत का सहारा है तो\nजीना कुछ और आसान हुआ जाता है\n\nऔर कुछ और भी हैरानी है मुझे\nतेरे मिलने की तमन्ना, इंतज़ार तेरा\nअब भी बाकी है मगर, दर्द तेरा\nअब तुझ से भी अज़ीज़ हुआ जाता है",
    contentTrans: "Dil ki zameen par tere dard ka ped\nDheere-dheere kuchh aur phailta jaata hai\nHar raat teri yaad jab barasti hai\nHar patta kuchh aur hara ho jaata hai\n\nKuchh phool bhi khilne lage hain aas paas\nMausam kuchh aur badalta jaata hai\nTere dard ki aadat ka sahara hai toh\nJeena kuchh aur aasan hua jaata hai\n\nAur kuchh aur bhi hairani hai mujhe\nTere milne ki tamanna, intezaar tera\nAb bhi baaki hai magar, dard tera\nAb tujh se bhi azeez hua jaata hai",
    contentEn: "On the ground of my heart, the tree of your pain\nSlowly keeps spreading a little more\nEvery night when your memory rains\nEvery leaf becomes a little greener\n\nSome flowers have also begun to bloom nearby\nThe season keeps changing a little more\nWith the support of the habit of your pain\nLiving becomes a little easier\n\nAnd something else surprises me\nThe desire to meet you, the waiting for you\nIs still there, yet your pain\nIs becoming even dearer to me than you"
  },
  {
    title: "ये साली ज़िंदगी ...",
    titleTrans: "Ye Saali Zindagi ...",
    titleEn: "This Wretched Life...",
    content: "ये साली ज़िंदगी ...\nबेतरतीब बंधी डोर की तरह\nउलझती सी रहती है\n\nहर वक़्त, हर तरफ, हर जगह\nकुछ ढूँढती सी रहती है\n\nशराब दोनों जहां की पी कर भी\nहर दम प्यासी रहती है\n\nना बहकती है\nना संभलती है\n\nना पूरी बुझती है\nना खुल के जलती है\n\nना मेरी होती है\nना तेरी बनती है\n\nकिसी अपने की बेवजह बेवफाई की तरह\nदिल के भीतर कुछ कसमसाती सी रहती है\n\nये साली ज़िंदगी ...",
    contentTrans: "Ye saali zindagi...\nBetarteeb bandhi dor ki tarah\nUlajhti si rehti hai\n\nHar waqt, har taraf, har jagah\nKuchh dhoondhti si rehti hai\n\nSharaab dono jahan ki pee kar bhi\nHar dam pyaasi rehti hai\n\nNa behakti hai\nNa sambhalti hai\n\nNa poori bujhti hai\nNa khul ke jalti hai\n\nNa meri hoti hai\nNa teri banti hai\n\nKisi apne ki bewajah bewafai ki tarah\nDil ke bheetar kuchh kasmasaati si rehti hai\n\nYe saali zindagi...",
    contentEn: "This wretched life...\nLike a haphazardly tied string\nIt remains tangled\n\nAll the time, in every direction, everywhere\nIt keeps searching for something\n\nEven after drinking the wine of both worlds\nIt remains thirsty every moment\n\nNeither does it wander off\nNor does it steady itself\n\nNeither is it fully extinguished\nNor does it burn brightly\n\nNeither does it become mine\nNor does it belong to you\n\nLike the needless betrayal of a loved one\nIt keeps restless within the heart\n\nThis wretched life..."
  },
  {
    title: "आवाज़",
    titleTrans: "Awaaz",
    titleEn: "The Voice",
    content: "सुलगती आहों में जब दिल डूबता सा लगता है\nकिसको आवाज़ दे कोई, जहां अजनबी सा लगता है\nकोई राहत, कोई चाहत, मसीहा टूटे हुए दिल का\nकिसी चमत्कार को ये दिल ढूँढता सौ लगता है\n\nकोई मसीहा मेरी राहत के लिए\nफिर शायद मेरे पास ना आने पाए\nमेरी आवाज़ गूंजती हो गलियों में\nकोई जवाब मेरी जानिब ना आने पाए\n\nगर थाम लूं आँहों को ज़रा\nबंद कर लूं निगाहों को ज़रा\nदिल को समझा लूं फिर से\nअपनी आवाज़ को रोकूँ तो ज़रा\n\nजब ये हस्ती कुछ और खामोश हो जायेगी\nये ऑहें, ये बेचैनौ कुछ और ज़रा थम जायेगी\n\nशायद किसी दोस्त की बरसों की दस्तक कोई\nआवाज़ जो मुझे ढून्ढ रही है जाने कब से\nसदा जो दबी रही शोरिशे-गेती में कहीं\nमेरी आँखों को सुनाई देगी, दिल में उतर जायेगी",
    contentTrans: "Sulagti aahon mein jab dil doobta sa lagta hai\nKisko awaaz de koi, jahan ajnabi sa lagta hai\nKoi rahat, koi chahat, masiha toote hue dil ka\nKisi chamatkar ko ye dil dhoondhta sa lagta hai\n\nKoi masiha meri rahat ke liye\nPhir shayad mere paas na aane paaye\nMeri awaaz goonjti ho galiyon mein\nKoi jawab meri jaanib na aane paaye\n\nGar thaam loon aahon ko zara\nBand kar loon nigahon ko zara\nDil ko samjha loon phir se\nApni awaaz ko rokoon toh zara\n\nJab ye hasti kuchh aur khamosh ho jayegi\nYe aahein, ye bechaini kuchh aur zara tham jayegi\n\nShayad kisi dost ki barson ki dastak koi\nAwaaz jo mujhe dhoondh rahi hai jaane kab se\nSada jo dabi rahi shorishe-geti mein kahin\nMeri aankhon ko sunayi degi, dil mein utar jayegi",
    contentEn: "When the heart feels drowning in burning sighs\nWho to call out to, when the world seems strange\nSome comfort, some desire, a messiah for a broken heart\nThis heart seems to search for a miracle\n\nAny messiah for my relief\nMay perhaps never come near me again\nMay my voice echo in the streets\nAnd no answer may come my way\n\nIf I just hold my sighs for a bit\nClose my eyes for a bit\nConsole my heart once more\nStop my voice for a bit\n\nWhen this existence becomes a bit more silent\nThese sighs, this restlessness will settle a bit\n\nPerhaps an old friend's knock of years past\nA voice that has been searching for me since who knows when\nA call that remained suppressed in the noise of the world\nWill be heard by my eyes, will descend into my heart"
  },
  {
    title: "जागीर",
    titleTrans: "Jageer",
    titleEn: "Inheritance",
    content: "मुफलिसी को ऐसे मिटाया हमने\nदर्द को जागीर बनाया हमने",
    contentTrans: "Muflisi ko aise mitaya humne\nDard ko jageer banaya humne",
    contentEn: "We erased poverty in such a way\nWe made pain our inheritance"
  },
  {
    title: "बरस",
    titleTrans: "Baras",
    titleEn: "Years",
    content: "अनगिनत रातों में, आँखों के आसमानों से\nबरसात बीती बातों की, बरस बरस बरसी है",
    contentTrans: "Anginat raaton mein, aankhon ke aasmanon se\nBarsaat beeti baaton ki, baras baras barsi hai",
    contentEn: "In countless nights, from the skies of the eyes\nThe rain of past moments, has poured for years"
  },
  {
    title: "उड़ान",
    titleTrans: "Udaan",
    titleEn: "Flight",
    content: "किसी की उड़ान पर खुशी तो हई मगर\nएक कसक भी उभर कर आई अक्सर\n\nपरवाज़ का शौक़ हमें भी था बहत\nथक के बैठ गए दम लेने को अक्सर\n\nकभी इस का कभी उस का सहारा लेकर\nहर ऊँचाई को छोटा किया है अक्सर\n\nपर आज छूना है जरा हाथ बढ़ा कर\nआसमां जो बहुत दूर लगा है अक्सर",
    contentTrans: "Kisi ki udaan par khushi toh hui magar\nEk kasak bhi ubhar kar aayi aksar\n\nParwaaz ka shauq humein bhi tha bahut\nThak ke baith gaye dam lene ko aksar\n\nKabhi is ka kabhi us ka sahara lekar\nHar oonchai ko chhota kiya hai aksar\n\nPar aaj chhoona hai zara haath badha kar\nAasmaan jo bahut door laga hai aksar",
    contentEn: "I felt happy for someone else's flight but\nAn ache also often surfaced\n\nI too had a great passion for flying\nOften sat down to catch my breath, tired\n\nTaking the support of this one or that one\nOften made every height feel smaller\n\nBut today I have to reach out and touch\nThe sky that has often seemed very far"
  },
  {
    title: "अभिनेता",
    titleTrans: "Abhineta",
    titleEn: "The Actor",
    content: "कल मार दिया मैंने\nमेरे अन्दर का\nखलनायक\n\nआज खुश है बहत\nमेरे भीतर काँ\nनायक\n\nअब दुनिया बदलेगी\nनायक की नायकी\nतेरे दुःख हर लेगी\n\nपर मैंने उसे भी जीने नहीं दिया\n\nऔर नायक का भी क़त्ल मेरे हाथों हो गया\n\nफिर मेरे दिल के कोनो में छिपा\nधीरे से बाहर आया\nबरसों से जो मेरे साथ है\nउसने सर उठाया, और कहा\n\nमैं, पीड़ित हूँ, मैं तेरे साथ हूँ\n\nउसने मेरा कन्धा थपथपाया\n\nऔर फिर दुनिया की नाइंसाफी का किस्सा दोहराया\n\nमुझे मालूम है मुझे क्या करना है\nअब इस पीड़ित को मरना है\n\nक्योंकि जब तक मेरे अन्दर नायक, खलनायक और पीड़ित रहेगा\nनुझे सही माइनों में जीने से रोकने वाला अभिनेता ज़िंदा रहेगा\n\nऔर मेरे दोस्त\nहैरान हूँ, समझ नहीं पा रहा हूँ\nमेरे अंदर के पीड़ित को\nमैं क्यों मार नहीं पा रहा हूँ ?",
    contentTrans: "Kal maar diya maine\nMere andar ka\nKhalnayak\n\nAaj khush hai bahut\nMere bheetar ka\nNayak\n\nAb duniya badlegi\nNayak ki nayaki\nTere dukh har legi\n\nPar maine use bhi jeene nahin diya\n\nAur nayak ka bhi qatl mere hathon ho gaya\n\nPhir mere dil ke kono mein chhipa\nDheere se bahar aaya\nBarson se jo mere saath hai\nUsne sar uthaya, aur kaha\n\nMain, peedit hoon, main tere saath hoon\n\nUsne mera kandha thapthapaya\n\nAur phir duniya ki nainsaafi ka kissa dohraya\n\nMujhe maloom hai mujhe kya karna hai\nAb is peedit ko marna hai\n\nKyonki jab tak mere andar nayak, khalnayak aur peedit rahega\nMujhe sahi mayanon mein jeene se rokne wala abhineta zinda rahega\n\nAur mere dost\nHairan hoon, samajh nahin paa raha hoon\nMere andar ke peedit ko\nMain kyon maar nahin paa raha hoon?",
    contentEn: "Yesterday I killed\nThe villain\nInside me\n\nToday the hero\nWithin me\nIs very happy\n\nNow the world will change\nThe hero's heroism\nWill take away your sorrows\n\nBut I didn't let him live either\n\nAnd the hero was also murdered by my hands\n\nThen hidden in the corners of my heart\nSlowly came out\nThe one who has been with me for years\nHe raised his head, and said\n\nI am the victim, I am with you\n\nHe patted my shoulder\n\nAnd then repeated the tale of the world's injustice\n\nI know what I have to do\nNow this victim has to die\n\nBecause as long as the hero, villain and victim remain inside me\nThe actor who stops me from truly living will remain alive\n\nAnd my friend\nI am surprised, I cannot understand\nThe victim inside me\nWhy am I unable to kill him?"
  },
  {
    title: "शौक़",
    titleTrans: "Shauq",
    titleEn: "Desire",
    content: "ख़्वाबों की लहद पर चल कर\nदिल ने ढ़ोया है भार जीने का\nकह भी देती जुबां तो क्या होता\nशौक़ है दर्द- -जाम पीने का",
    contentTrans: "Khwaabon ki lahad par chal kar\nDil ne dhoya hai bhaar jeene ka\nKeh bhi deti zuban toh kya hota\nShauq hai dard-e-jaam peene ka",
    contentEn: "Walking on the grave of dreams\nThe heart has carried the burden of living\nEven if the tongue had spoken, what would happen\nThere is a desire to drink the cup of pain"
  },
  {
    title: "मन",
    titleTrans: "Mann",
    titleEn: "The Mind",
    content: "हर उम्मीद में शामिल है\nमाज़ी के हवादिस की जलन\n\nहर उठे कदम में दाखिल है\nगिर-गिर के संभलने की चुभन\n\nकुछ वाजिब, नावाजिब है कुछ\nकमबख्त फिर है बहकने मन",
    contentTrans: "Har umeed mein shamil hai\nMaazi ke hawadis ki jalan\n\nHar uthe kadam mein dakhil hai\nGir-gir ke sambhalne ki chubhan\n\nKuchh wajib, nawajib hai kuchh\nKambakht phir hai behakne mann",
    contentEn: "Included in every hope is\nThe burning of the past's accidents\n\nEntered in every raised step is\nThe sting of falling and steadying again\n\nSome is reasonable, some unreasonable\nDamn it, the mind is ready to wander again"
  },
  {
    title: "ख्वाब",
    titleTrans: "Khwaab",
    titleEn: "Dreams",
    content: "तेरे ख़्वाबों के तकाज़े\nउम्मीदों के इशारे\n\nवो उल्फतों की शर्तें\nजो हिसाब मैंने हारे\n\nकोई रात अब बुझा दे\nकोई सुबह को पुकारे\n\nअब थक के सो गए हैं\nमेरे ख्वाब सब बेचारे",
    contentTrans: "Tere khwaabon ke takaaze\nUmeedon ke ishaare\n\nWo ulfaton ki shartein\nJo hisaab maine haare\n\nKoi raat ab bujha de\nKoi subah ko pukaare\n\nAb thak ke so gaye hain\nMere khwaab sab bechaare",
    contentEn: "The demands of your dreams\nThe signals of hopes\n\nThose conditions of love\nThe accounts I have lost\n\nLet someone extinguish the night now\nLet someone call out to the morning\n\nNow they have fallen asleep, tired\nAll my poor dreams"
  },
  {
    title: "सब्र",
    titleTrans: "Sabr",
    titleEn: "Patience",
    content: "तनहा रहना सबके साथ\nहुनर अपना नया नहीं कोई\n\nग़ज़ल से गुफ्तगू हर शाम\nशौक़ अपना नया नहीं कोई\n\nथोड़ी बेखुदी .. थोड़ा उनका तस्सव्वुर .. थोड़ी सी चांदनी\n\nइंतज़ार महफ़िल का हर रोज़\nसब्र अपना नया नहीं कोई",
    contentTrans: "Tanha rehna sabke saath\nHunar apna naya nahin koi\n\nGhazal se guftagoo har shaam\nShauq apna naya nahin koi\n\nThodi bekhudi .. thoda unka tassavvur .. thodi si chandni\n\nIntezaar mehfil ka har roz\nSabr apna naya nahin koi",
    contentEn: "To remain lonely while being with everyone\nIs not a new skill of mine\n\nConversing with ghazals every evening\nIs not a new hobby of mine\n\nA little self-oblivion.. a little imagination of them.. a little moonlight\n\nWaiting for the gathering every day\nIs not a new patience of mine"
  },
  {
    title: "शब्द",
    titleTrans: "Shabd",
    titleEn: "Words",
    content: "तुम्हारे शब्दों के जाल में\nअक्सर उलझा है अहसास मेरा\nशब्दों के अस्त्र से\nआहत भी हुआ हूँ\n\nपर शब्दों के अंकुश मैंने भी चुभोये हैं\nदर्द शब्दों से और निशब्द\nमैंने भी दिया है तुमको\n\nजिनसे शुरू की थी हमने मंजिलें सारी\nअब वहीं शब्द फिर से दोहराने होंगे\nशब्द जो पहचानते हैं रंजिशें सारी\nशब्द सुकून के फिर आजमाने होंगे\n\nक्या फिर शब्द उठा पायेंगे?\nमाज़ी का बोझ कहीं ज्यादा तो नहीं ?\nमेरी जुर्रत और तेरी जरूरत के लिए\nशब्द ये बेहद सादा तो नहीं ?\n\nया कोई बहकता हुआ शब्द\nकिसी ख़याल की उंगली थामे\nकिसी पुराने ज़ख्म को साथ लिए\n\nफैल जाएगा कोशिश भरे शब्दों पर\nकिसी बादल, किसी धुएं की तरह\n\nऔर फिर एक नया सफ़र शुरू होगा- शब्दों के बिना -- तनहा ?",
    contentTrans: "Tumhare shabdon ke jaal mein\nAksar uljha hai ahsaas mera\nShabdon ke astra se\nAahat bhi hua hoon\n\nPar shabdon ke ankush maine bhi chubhoye hain\nDard shabdon se aur nishabd\nMaine bhi diya hai tumko\n\nJinse shuru ki thi humne manzilein saari\nAb wahi shabd phir se dohrane honge\nShabd jo pehchante hain ranjishein saari\nShabd sukoon ke phir aazmane honge\n\nKya phir shabd utha paayenge?\nMaazi ka bojh kahin zyada toh nahin?\nMeri jurrat aur teri zaroorat ke liye\nShabd ye behad saada toh nahin?\n\nYa koi behakta hua shabd\nKisi khayal ki ungli thaame\nKisi purane zakhm ko saath liye\n\nPhail jayega koshish bhare shabdon par\nKisi badal, kisi dhuen ki tarah\n\nAur phir ek naya safar shuru hoga- shabdon ke bina -- tanha?",
    contentEn: "In the web of your words\nMy feelings have often tangled\nBy the weapon of words\nI have also been hurt\n\nBut I have also pierced with the goad of words\nPain through words and without words\nI have also given to you\n\nThe ones with which we started all our journeys\nNow those same words will have to be repeated\nThe words that recognize all grievances\nWords of comfort will have to be tried again\n\nWill we be able to pick up words again?\nIs the burden of the past not too much?\nFor my daring and your need\nAre these words not too simple?\n\nOr some wandering word\nHolding the finger of a thought\nTaking an old wound along\n\nWill spread over the attempt-filled words\nLike a cloud, like smoke\n\nAnd then a new journey will begin- without words -- lonely?"
  },
  {
    title: "उम्मीद",
    titleTrans: "Umeed",
    titleEn: "Hope",
    content: "उठेंगी मेरी तरफ़ कब तेरी नजरें झुकी हुई\nबरसों से इस उम्मीद में हैं सांसें रुकी हुई\n\nकहा तो कुछ भी नहीं था तेरी जुबां ने कभी\nसुनी हैं बारहा तेरे लब पे सदायै रुकी हुई\n\nतेरे कंजेलब की हलकी सी जुम्बिश के लिए\nमेरी सुबह, मेरी शाम, हैं मेरी रातें रुकी हुई\n\nअब तुम पे टिकी है मेरी मंजिल, मेरी हस्ती\nथमौ है रूह, दोनों जहां की राहें रुकी हुई",
    contentTrans: "Uthengi meri taraf kab teri nazrein jhuki hui\nBarson se is umeed mein hain saansein ruki hui\n\nKaha toh kuchh bhi nahin tha teri zuban ne kabhi\nSuni hain baarha tere lab pe sadayein ruki hui\n\nTere kunj-e-lab ki halki si jumbish ke liye\nMeri subah, meri shaam, hain meri raatein ruki hui\n\nAb tum pe tiki hai meri manzil, meri hasti\nThami hai rooh, dono jahan ki raahein ruki hui",
    contentEn: "When will your lowered gaze rise towards me\nFor years, breaths have stopped in this hope\n\nYour tongue had never said anything\nYet I have often heard suppressed calls on your lips\n\nFor a slight movement of your lips\nMy mornings, my evenings, my nights are paused\n\nNow my destination, my existence rests on you\nThe soul has stopped, the paths of both worlds are paused"
  },
  {
    title: "ज़िंदा",
    titleTrans: "Zinda",
    titleEn: "Alive",
    content: "रात सितारों को देखा तो यह अहसास हआ\nखामोश जगमगाहट में .. कुछ है शायद\nकोई जादू, कोई तरकीब या कोई रब की दुआ\nएक अनजान सी आहट है... कोई है शायद\n\nएक उम्मीद सी जागी के दुआ मांगू\nकोई मेरे इस ख्वाब को पूरा कर दे\nअबके जब सुबह आये और मैं जागू\nबस फिर एक बार मुझे ज़िंदा कर दें",
    contentTrans: "Raat sitaron ko dekha toh yeh ahsaas hua\nKhamosh jagmagahat mein .. kuchh hai shayad\nKoi jadoo, koi tarkeeb ya koi rab ki dua\nEk anjaan si aahat hai... koi hai shayad\n\nEk umeed si jaagi ke dua mangoon\nKoi mere is khwaab ko poora kar de\nAbke jab subah aaye aur main jaagoon\nBas phir ek baar mujhe zinda kar dein",
    contentEn: "Looking at the stars at night, I felt this\nIn the silent glow.. perhaps there is something\nSome magic, some trick or some prayer to God\nThere is an unknown rustle... perhaps someone is there\n\nA hope awoke that I should pray\nSomeone should fulfill this dream of mine\nThis time when morning comes and I wake up\nJust make me alive one more time"
  },
  {
    title: "गुनाह",
    titleTrans: "Gunah",
    titleEn: "Sin",
    content: "किसी गुनाह की लज्ज़त के लिए\nतेरी पनाह की चाहत के लिए\n\nफिर एक बार तलबगार है दिल\nआज की शाम बेकरार है दिल\n\nदुनिया इसे पाप कहेगी शायद\nहाँ ये प्यार नहीं है शायद\n\nजानता है मगर लाचार है दिल\nआज की शाम बेकरार है दिल",
    contentTrans: "Kisi gunah ki lazzat ke liye\nTeri panah ki chahat ke liye\n\nPhir ek baar talabgaar hai dil\nAaj ki shaam beqarar hai dil\n\nDuniya ise paap kahegi shayad\nHaan ye pyaar nahin hai shayad\n\nJaanta hai magar lachaar hai dil\nAaj ki shaam beqarar hai dil",
    contentEn: "For the pleasure of some sin\nFor the desire of your shelter\n\nOnce again the heart is a seeker\nThis evening the heart is restless\n\nThe world will probably call it a sin\nYes, perhaps this is not love\n\nIt knows but the heart is helpless\nThis evening the heart is restless"
  },
  {
    title: "रावण",
    titleTrans: "Ravan",
    titleEn: "Ravan",
    content: "मैं रावण हूं ...\n\nदशानन के सारे दस सिर मेरे अंदर हैं\nऔर जब तब उभर आते हैं\nतुमने कभी शायद देखा होगा\nजो सिर गुस्से मे अंधा हो जता है\n\nया वोह जो भीतर जलता है.. तुम से.. सब से\nया फिर वोह जो लपकता है... ललचता है ... हर चमकती चीज़ पर\nमैने सब देखे हैं... और सब अभी ज़िंदा हैं\nनहीं जानता मेरा दुशेराह कब आयेगा",
    contentTrans: "Main ravan hoon ...\n\nDashanan ke saare das sir mere andar hain\nAur jab tab ubhar aate hain\nTumne kabhi shayad dekha hoga\nJo sir gusse mein andha ho jaata hai\n\nYa woh jo bheetar jalta hai.. tum se.. sab se\nYa phir woh jo lapakta hai... lalchata hai ... har chamakti cheez par\nMaine sab dekhe hain... aur sab abhi zinda hain\nNahin jaanta mera dussehra kab aayega",
    contentEn: "I am Ravan...\n\nAll ten heads of Dashanan are within me\nAnd they emerge now and then\nYou might have seen it sometime\nThe head that becomes blind with rage\n\nOr that which burns within... at you... at everyone\nOr the one that pounces... that covets... every shiny thing\nI have seen them all... and all are still alive\nI do not know when my Dussehra will come"
  },
  {
    title: "तस्सव्वुर",
    titleTrans: "Tassavvur",
    titleEn: "Imagination",
    content: "तेरा तस्सव्वुर है, तन्हाई है और कुछ भी नहीं है\nमहकी-महकी सी हवा है - और कुछ भी नहीं है\n\nचंद बूँदें हैं जो बादलों से टूट के बिखरी हैं इधर\nठहरे हुए पानी में तेरा अक्स है - और कुछ भी नहीं है\n\nबंद आँखों के परे तेरे तस्सव्वुर की दुनिया है बस\nना कोई दर्द ना खुशी - आज और कुछ भी नहीं है",
    contentTrans: "Tera tassavvur hai, tanhai hai aur kuchh bhi nahin hai\nMehki-mehki si hawa hai - aur kuchh bhi nahin hai\n\nChand boondein hain jo baadalon se toot ke bikhri hain idhar\nThehre hue paani mein tera aks hai - aur kuchh bhi nahin hai\n\nBand aankhon ke pare tere tassavvur ki duniya hai bas\nNa koi dard na khushi - aaj aur kuchh bhi nahin hai",
    contentEn: "Your imagination is here, loneliness is here, and nothing else\nThe breeze is fragrant - and nothing else\n\nThere are a few drops that broke from the clouds and scattered here\nYour reflection is in the still water - and nothing else\n\nBeyond closed eyes is just the world of your imagination\nNeither any pain nor joy - today there is nothing else"
  },
  {
    title: "लम्हा लम्हा ज़िन्दगी",
    titleTrans: "Lamha Lamha Zindagi",
    titleEn: "Life, Moment by Moment",
    content: "एक पल, एक लम्हा\nएक ग़म, एक दर्द,\n\nज़िन्दगी जिस में समा जाए\nदिल जिस में लह हो जाए\n\nएक चाह, एक नज़र - रूह तक जिस मैं डूब जाए\n\nयह ख्याल में बहुत पीछे छोड़ आया हूँ\nआज इस मोड़ परै, छोटी उमीदें लाया हूँ\n\nबूंद-बूंद चाह,\nझुकी-झुकी निगाह\n\nथोडा-थोडा गम,\nकतरा-कतरा दर्द\n\nमद्धम - मद्धम,\n\nज़रा-ज़रा,\nलम्हा लम्हा\nज़िन्दगी",
    contentTrans: "Ek pal, ek lamha\nEk gham, ek dard,\n\nZindagi jis mein sama jaaye\nDil jis mein lahoo ho jaaye\n\nEk chaah, ek nazar - rooh tak jis mein doob jaaye\n\nYeh khayal main bahut peechhe chhod aaya hoon\nAaj is mod par, chhoti umeedein laya hoon\n\nBoond-boond chaah,\nJhuki-jhuki nigah\n\nThoda-thoda gham,\nKatra-katra dard\n\nMaddham - maddham,\n\nZara-zara,\nLamha lamha\nZindagi",
    contentEn: "One moment, one instant\nOne sorrow, one pain,\n\nIn which life is contained\nIn which the heart becomes blood\n\nOne desire, one look - in which the soul drowns\n\nI have left these thoughts far behind\nToday at this turn, I have brought small hopes\n\nDrop by drop desire,\nLowered gaze\n\nLittle by little sorrow,\nDrop by drop pain\n\nFaint - faint,\n\nA little bit,\nMoment by moment\nLife"
  },
  {
    title: "ज़िन्दगी",
    titleTrans: "Zindagi",
    titleEn: "Life",
    content: "मैं छाता विलये, बचता फिरा, सूखा रहा\n\nमेरे चारों तरफ़ ज़िंदगी,\nबरसती रही,\nबरसती रही\n\nमैं ओक से, पीने की किोशश करता रहा\n\nमेरे हाथों से वोह,\nछलकती रही,\nछलकती ही रही",
    contentTrans: "Main chhata liye, bachta phira, sookha raha\n\nMere charon taraf zindagi,\nBarasti rahi,\nBarasti rahi\n\nMain oak se, peene ki koshish karta raha\n\nMere hathon se woh,\nChhalakti rahi,\nChhalakti hi rahi",
    contentEn: "Holding an umbrella, I kept dodging, remained dry\n\nAll around me, Life\nKept raining\nKept raining\n\nI tried to drink it with cupped hands\n\nBut from my hands, it\nKept spilling\nKept spilling over"
  },
  {
    title: "जाल",
    titleTrans: "Jaal",
    titleEn: "The Web",
    content: "फिर नयी सुबह आई और फिर नया जाल बुना मैने\nचांदनी का, खुशबू का\n\nतेरे साथ फिर नयी शाम का खयाल बुना मैने\n\nफिर कोइ बेकार सी उलझन, नया जंजाल चुना मैने\nरिश्तों की, रोज़गार की\n\nसब की सुनी, फिर बेचारे दिल का ना हाल सुना मैने",
    contentTrans: "Phir nayi subah aayi aur phir naya jaal buna maine\nChandni ka, khushboo ka\n\nTere saath phir nayi shaam ka khayal buna maine\n\nPhir koi bekaar si uljhan, naya janjaal chuna maine\nRishton ki, rozgaar ki\n\nSab ki suni, phir bechare dil ka na haal suna maine",
    contentEn: "Then a new morning came and I wove a new web again\nOf moonlight, of fragrance\n\nI wove the thought of a new evening with you again\n\nThen I chose some useless tangle, a new trap again\nOf relationships, of employment\n\nI listened to everyone, but didn't listen to the state of the poor heart"
  },
  {
    title: "एक पल की हंसी",
    titleTrans: "Ek Pal Ki Hansi",
    titleEn: "A Moment's Smile",
    content: "तुम्हें क्या पता मुस्कराने से पहले\nदर्द कितने दिल के दबाने हैं पड़ते\n\nकहकहा ज़ोर से यूँ लगाने से पहले\nअश्क़ आँखों के कितने छुपाने हैं पड़ते\n\nये मैं जानता हूँ गमे-ज़िंदगी मे\nलम्हे खुशियों के कैसे चुराने हैं पड़ते\n\nके इस एक पल की हंसी के लिए\nहज़ार ग़म भी कभी भूल जाने हैं पड़ते",
    contentTrans: "Tumhein kya pata muskurane se pehle\nDard kitne dil ke dabane hain padte\n\nKahkaha zor se yoon lagane se pehle\nAshq aankhon ke kitne chhupane hain padte\n\nYe main jaanta hoon gham-e-zindagi mein\nLamhe khushiyon ke kaise churane hain padte\n\nKe is ek pal ki hansi ke liye\nHazaar gham bhi kabhi bhool jaane hain padte",
    contentEn: "What do you know, before smiling\nHow many pains of the heart must be suppressed\n\nBefore bursting into loud laughter like this\nHow many tears of the eyes must be hidden\n\nI know this, in the sorrow of life\nHow moments of happiness must be stolen\n\nThat for this one moment's smile\nSometimes a thousand sorrows must be forgotten"
  },
  {
    title: "ये बरस अजीब सा",
    titleTrans: "Ye Baras Ajeeb Sa",
    titleEn: "This Strange Year",
    content: "बांटी बधाई हर रोज़ गैरों को इस बरस\nजम के मुस्कुराया हर महफ़िल में इस बरस\n\nभरे सबके जाम बन के साकी भी इस बरस\nथा रकीब की दावत में शामिल भी इस बरस\n\nफूलों का साथ था, कहाँ खुशबू थी इस बरस ?\nतू करीब था, तन्हाई की जुस्तजू भी इस बरस\n\nबरस बरस के थक गई बरसात इस बरस\nतरस तरस के सो गई इक प्यास इस बरस\n\nखाली था अजनबी था, ये बरस अजीब सा\nज्यों गुज़रा हो किसी और पे ये बरस अजीब सा",
    contentTrans: "Baanti badhai har roz gairon ko is baras\nJam ke muskuraya har mehfil mein is baras\n\nBhare sabke jaam ban ke saaqi bhi is baras\nTha rakeeb ki dawat mein shamil bhi is baras\n\nPhoolon ka saath tha, kahan khushboo thi is baras?\nTu kareeb tha, tanhai ki justajoo bhi is baras\n\nBaras baras ke thak gayi barsaat is baras\nTaras taras ke so gayi ik pyaas is baras\n\nKhaali tha ajnabi tha, ye baras ajeeb sa\nJyon guzra ho kisi aur pe ye baras ajeeb sa",
    contentEn: "Distributed congratulations every day to strangers this year\nSmiled heartily in every gathering this year\n\nFilled everyone's cups becoming the cupbearer too this year\nWas included in the rival's feast too this year\n\nThere was the company of flowers, but where was the fragrance this year?\nYou were close, yet there was the quest for loneliness this year\n\nThe rain got tired of raining this year\nA thirst fell asleep yearning this year\n\nIt was empty, it was a stranger, this strange year\nAs if this strange year passed upon someone else"
  },
  {
    title: "ज़्यादा",
    titleTrans: "Zyada",
    titleEn: "Too Much",
    content: "जुरूरत किसी मसीहा की\nआज कुछ ज़ुरूरत से ज़्यादा है\nजलालते कम नहीं थी पहले भी\nआज हद और कुछ ज़्यादा है\n\nइससे पहले भी दिल रोया था\nआज दर्द और कुछ ज़्यादा है\nइंसानियत पहले भी हुई शर्मिंदा\nआज शर्म पहले से कुछ ज़्यादा है\n\nअब के रुकना नहीं ना झुकना है\nदिल मे कुछ आग भी ज़्यादा है\nसंभल करें खेलना बाज़ी ए दोस्त\nदांव आज और कुछ ज़्यादा है",
    contentTrans: "Zaroorat kisi masiha ki\nAaj kuchh zaroorat se zyada hai\nZallalatein kam nahin thi pehle bhi\nAaj hadh aur kuchh zyada hai\n\nIsse pehle bhi dil roya tha\nAaj dard aur kuchh zyada hai\nInsaniyat pehle bhi hui sharminda\nAaj sharm pehle se kuchh zyada hai\n\nAb ke rukna nahin na jhukna hai\nDil mein kuchh aag bhi zyada hai\nSambhal kar khelna baazi ae dost\nDaav aaj aur kuchh zyada hai",
    contentEn: "The need for a messiah\nIs somewhat more than necessary today\nHumiliations were not less before either\nToday the limit is somewhat more\n\nThe heart had cried before this too\nToday the pain is somewhat more\nHumanity was ashamed before too\nToday the shame is somewhat more than before\n\nThis time there is no stopping nor bowing\nThere is also somewhat more fire in the heart\nPlay the game carefully, my friend\nThe stakes today are somewhat more"
  },
  {
    title: "दिल्ली",
    titleTrans: "Dilli",
    titleEn: "Delhi",
    content: "यूँ निकलते हैं दिल्ली में कुछ लोग इस तरह\nआदमखोर ज्यों रातों पे चलें हों शिकार पर\nरोज़ ग़ालिब की ये गलियां रोती हैं रात भर\nइस्मत के मासूम फूल, इन्साफ के मज़ार पर\n\n*दिसंबर 2012 के जन आन्दोलन के दौरान",
    contentTrans: "Yoon nikalte hain dilli mein kuchh log is tarah\nAadamkhor jyon raaton pe chalein hon shikaar par\nRoz Ghalib ki ye galiyan roti hain raat bhar\nIsmat ke masoom phool, insaaf ke mazar par\n\n*December 2012 ke jan aandolan ke dauran",
    contentEn: "Some people set out in Delhi in such a way\nAs if man-eaters walk the nights on a hunt\nEvery day these streets of Ghalib weep all night\nOn the shrine of justice, the innocent flowers of honor\n\n*During the December 2012 mass protests"
  },
  {
    title: "तूफां से कोई कह दे",
    titleTrans: "Toofan Se Koi Keh De",
    titleEn: "Tell the Storm",
    content: "तूफां से कोई कह दे\nथोड़ा और ठहर जाए\n\nरास आता नहीं मुझको\nसुकं जो सबको प्यारा है\nराह सबने चुनी है जो\nनहीं मुझको गंवारा है\n\nउफनती लहरों के सीने पे\nबहकती मस्त हवाओं में\nधार मंझधार के भीतर\nघने उबलते अंधेरों में\n\nझूम कर रक्स करने की\nख्वाहिश अब भी बाक़ी है\nइश्क में फिर से मरने की\nख्वाहिश अब भी बाकी है\n\nतूफां से कोई कह दे - थोडा और ठहर जाए",
    contentTrans: "Toofan se koi keh de\nThoda aur thehar jaaye\n\nRaas aata nahin mujhko\nSukoon jo sabko pyara hai\nRaah sabne chuni hai jo\nNahin mujhko gawara hai\n\nUfanti lehron ke seene pe\nBehakti mast hawaon mein\nDhaar manjhdhaar ke bheetar\nGhane ubalte andheron mein\n\nJhoom kar raqs karne ki\nKhwahish ab bhi baaki hai\nIshq mein phir se marne ki\nKhwahish ab bhi baaki hai\n\nToofan se koi keh de - thoda aur thehar jaaye",
    contentEn: "Let someone tell the storm\nTo pause a little longer\n\nThe peace that is dear to everyone\nDoes not suit me\nThe path that everyone has chosen\nIs not acceptable to me\n\nOn the chest of surging waves\nIn the intoxicating wandering winds\nWithin the midstream of the current\nIn thick boiling darknesses\n\nThe desire to dance swaying\nIs still remaining\nThe desire to die in love again\nIs still remaining\n\nLet someone tell the storm - to pause a little longer"
  },
  {
    title: "शायरी",
    titleTrans: "Shayari",
    titleEn: "Poetry",
    content: "शौक़ ये लाज़मी तो है लेकिन\nकिस्मत वालों को नसीब होता है\nज़िन्दगी को नज़्म की तरह गाये\nवोह दीवानगी के करीब होता है\n\nजुर्म हो या हो शौक़-ए-बेकार\nशायरी बस मेरी मजबूरी है\nइलाजे-दर्दे-दुनिया के लिए\nये राहत बहुत जुरूरी है",
    contentTrans: "Shauq ye laazmi toh hai lekin\nKismat walon ko naseeb hota hai\nZindagi ko nazm ki tarah gaaye\nWoh deewangi ke kareeb hota hai\n\nJurm ho ya ho shauq-e-bekaar\nShayari bas meri majboori hai\nIlaaj-e-dard-e-duniya ke liye\nYe rahat bahut zaroori hai",
    contentEn: "This hobby is inevitable but\nIt is destined only for the lucky ones\nHe who sings life like a poem\nIs close to madness\n\nWhether it's a crime or a useless hobby\nPoetry is simply my compulsion\nAs a cure for the pain of the world\nThis relief is very necessary"
  },
  {
    title: "हालत",
    titleTrans: "Haalat",
    titleEn: "Condition",
    content: "ऐ दिल आज तेरी ये हालत है क्या\nक्यूँ है टूटा हुआ - इतना डूबा हुआ\nजैसे खत कोई उम्मीदों से भरा\nमसल कर फर्श पर है फैंका हुआ",
    contentTrans: "Ae dil aaj teri ye haalat hai kya\nKyun hai toota hua - itna dooba hua\nJaise khat koi umeedon se bhara\nMasal kar farsh par hai phenka hua",
    contentEn: "Oh heart, what is this condition of yours today\nWhy are you so broken - so drowned\nLike some letter filled with hopes\nCrushed and thrown upon the floor"
  },
  {
    title: "ये शहद से मीठी शाम",
    titleTrans: "Ye Shahad Se Meethi Shaam",
    titleEn: "This Honey-Sweet Evening",
    content: "ये शहद से मीठी शाम\nपल पल, थम थम\nटपकी टप टप\n\nशब् शब् शबनम\n\nचुप चुप नज़रें\nगुप चुप बातें\nधम धम धड़कन\n\nजलती जलती\n\nसुलगी सुलगी\n\nबैहकी बहकी\n\nमहकी महकी\n\nमधुर मधुर\n\nरेशम रेशम\n\nआखरी मुलाकात की\nतर्क-ए-ताल्लुकात की\n\nकोई करामात की\n\nकैसे भूले कोई\nकैसे जी ले कोई\nरात रोको कोई\n\nजां निकलने को है\nसांस रुकने को है\nअब गुजरने को है\n\nये शहद से मीठी शाम",
    contentTrans: "Ye shahad se meethi shaam\nPal pal, tham tham\nTapki tap tap\n\nShab shab shabnam\n\nChup chup nazrein\nGup chup baatein\nDham dham dhadkan\n\nJalti jalti\n\nSulgi sulgi\n\nBehki behki\n\nMehki mehki\n\nMadhur madhur\n\nResham resham\n\nAakhri mulaqat ki\nTark-e-talluqaat ki\n\nKoi karamaat ki\n\nKaise bhoole koi\nKaise jee le koi\nRaat roko koi\n\nJaan nikalne ko hai\nSaans rukne ko hai\nAb guzarne ko hai\n\nYe shahad se meethi shaam",
    contentEn: "This honey-sweet evening\nMoment by moment, pausing\nDripping drop by drop\n\nDew, dew, every night\n\nSilent, silent glances\nSecret, secret talks\nThump, thump heartbeat\n\nBurning, burning\n\nSmoldering, smoldering\n\nWandering, wandering\n\nFragrant, fragrant\n\nSweet, sweet\n\nSilken, silken\n\nOf the last meeting\nOf breaking off relations\n\nOf some miracle\n\nHow can anyone forget\nHow can anyone live\nLet someone stop the night\n\nLife is about to leave\nBreath is about to stop\nNow it is about to pass\n\nThis honey-sweet evening"
  },
  {
    title: "उसने कहा था",
    titleTrans: "Usne Kaha Tha",
    titleEn: "She Had Said",
    content: "उसने कहा था\nये इलज़ाम नहीं है\nफिर क्यूँ मैं शर्मिन्दा हूँ\n\nउसने कहा था\nये शिकवा नहीं है\nफिर क्यूँ मैं परेशां हूँ\n\nजो उसने नहीं कहा है\nवही कहा है अक्सर उसने",
    contentTrans: "Usne kaha tha\nYe ilzaam nahin hai\nPhir kyun main sharminda hoon\n\nUsne kaha tha\nYe shikwa nahin hai\nPhir kyun main pareshaan hoon\n\nJo usne nahin kaha hai\nWahi kaha hai aksar usne",
    contentEn: "She had said\nThis is not an accusation\nThen why am I ashamed\n\nShe had said\nThis is not a complaint\nThen why am I troubled\n\nWhat she has not said\nThat is what she has often said"
  },
  {
    title: "Complication!",
    titleTrans: "Complication!",
    titleEn: "Complication!",
    content: "वो शहद से मीठी शाम ...\nवो रस बरसाती भीगी सी हवा\nवक़्त थिरक रहा था लहरों सा\nबिखरा था वहां गहरा सा नशा\n\nमदहोश था दिल बेहोश था मैं\nतब जीना मरना कुछ भी ना था\nफिर पलकों को उठा कर तुमने कहा\nदेखो.. lets not complicate things .....",
    contentTrans: "Wo shahad se meethi shaam ...\nWo ras barsaati bheegi si hawa\nWaqt thirak raha tha lehron sa\nBikhra tha wahan gehra sa nasha\n\nMadhosh tha dil behosh tha main\nTab jeena marna kuchh bhi na tha\nPhir palkon ko utha kar tumne kaha\nDekho.. lets not complicate things .....",
    contentEn: "That honey-sweet evening...\nThat moist breeze raining nectar\nTime was dancing like the waves\nA deep intoxication was scattered there\n\nThe heart was intoxicated, I was senseless\nThen living and dying meant nothing\nThen lifting your eyelashes you said\nLook.. let's not complicate things....."
  },
  {
    title: "जाने दो",
    titleTrans: "Jaane Do",
    titleEn: "Let It Go",
    content: "वफ़ा की उम्मीद बेवफाई का गिला जाने दो\nक्या दोस्तों से क्या दुश्मनों से मिला जाने दो\nखुद अपनी हरकतों का है अहसास मुझे\nक्या दिया किस को वफ़ाओं का सिला- जाने दो",
    contentTrans: "Wafa ki umeed bewafai ka gila jaane do\nKya doston se kya dushmanon se mila jaane do\nKhud apni harkaton ka hai ahsaas mujhe\nKya diya kis ko wafaon ka sila- jaane do",
    contentEn: "The hope for loyalty, the complaint of betrayal, let it go\nWhat I got from friends, what from enemies, let it go\nI myself am aware of my own actions\nWhat reward for loyalty I gave to whom - let it go"
  },
  {
    title: "मुजरिम",
    titleTrans: "Mujrim",
    titleEn: "The Culprit",
    content: "जब से मुंह में जुबान आई है\nऔर आँखों ने रौशनी पायी है\nदिल में अहसास सा कोई जागा\nतब से कहने को कुछ मचलता है\nऔर ये दिल नहीं संभलता है\n\nना दस्तक नहीं है दुनिया की\nना नया दौर या ज़माना है\nतुम ने शायद नहीं तवज्जोह दी\nवर्ना मुजरिम तो ये पुराना है",
    contentTrans: "Jab se munh mein zuban aayi hai\nAur aankhon ne roshni paayi hai\nDil mein ahsaas sa koi jaaga\nTab se kehne ko kuchh machalta hai\nAur ye dil nahin sambhalta hai\n\nNa dastak nahin hai duniya ki\nNa naya daur ya zamana hai\nTum ne shayad nahin tawajjoh di\nWarna mujrim toh ye purana hai",
    contentEn: "Ever since the tongue has come to the mouth\nAnd the eyes have found light\nSome feeling awoke in the heart\nSince then something yearns to be said\nAnd this heart cannot be controlled\n\nIt is neither a knock from the world\nNor a new era or age\nPerhaps you did not pay attention\nOtherwise this culprit is an old one"
  },
  {
    title: "बरसात",
    titleTrans: "Barsaat",
    titleEn: "Rain",
    content: "दर्द-दस्तक दरो-दीवार से आती है\nदिले-बेबस से फ़रियाद सी आती है\nयाद की एक बूँद रुला जाती है हमें\nऔर तेरी यादों की बरसात सी आती है",
    contentTrans: "Dard-dastak dar-o-deewar se aati hai\nDil-e-bebas se fariyaad si aati hai\nYaad ki ek boond rula jaati hai humein\nAur teri yaadon ki बरसात si aati hai",
    contentEn: "The knock of pain comes from the doors and walls\nA plea comes from the helpless heart\nA single drop of memory makes us cry\nAnd then a rain of your memories comes"
  },
  {
    title: "फिर वही मोड़",
    titleTrans: "Phir Wahi Mod",
    titleEn: "That Same Turn Again",
    content: "फिर वही मोड़ नज़र आता है -\nज़िंदगी गोल है ज़मीं की तरह\nऔर भी मोड़ हैं उस मोड़ के पार\n\nमंजिलें राह तकती हैं कई\nचाहतें तलाशती हैं कई\nचाँद कुछ और हसीं है शायद\nमौसम और भी रंगीं है शायद\nऔर भी राहतें हैं उस मोड़ के पार\n\nमुड़ ही जाऊंगा इस बार\nपहले भी यही सोचा था\nरोके ना रुकंगा इस बार\nपहले भी यही सोचा था\n\nजुल्फें, दामन, रिश्ते, माज़ी\nछौड़ के सब को बढ़ जाऊंगा\nहाँ- पहले भी यही सोचा था\n\nफिर वही मोड़ नज़र आता है\nवही दिल की हालत है फिर से\nज़ुल्फ़ लहराने लगी है फिर से\nरोकती है कशिश रिश्तों की\n\nकोई आवाज़ खींचती है फिर से\nरुक जाऊं, गुज़र जाऊं या मुड़ जाऊं\nसवाल आन खडा है फिर से\nघूमता है ख्याल दिल में फिर से\nज़िंदगी गोल है ज़मीन की तरह",
    contentTrans: "Phir wahi mod nazar aata hai -\nZindagi gol hai zameen ki tarah\nAur bhi mod hain us mod ke paar\n\nManzilein raah takti hain kai\nChahtein talashti hain kai\nChaand kuchh aur haseen hai shayad\nMausam aur bhi rangeen hai shayad\nAur bhi rahatein hain us mod ke paar\n\nMud hi jaunga is baar\nPehle bhi yahi socha tha\nRoke na rukoonga is baar\nPehle bhi yahi socha tha\n\nZulfein, daaman, rishte, maazi\nChhod ke sab ko badh jaunga\nHaan- pehle bhi yahi socha tha\n\nPhir wahi mod nazar aata hai\nWahi dil ki haalat hai phir se\nZulf lehrane lagi hai phir se\nRokti hai kashish rishton ki\n\nKoi awaaz kheenchti hai phir se\nRuk jaoon, guzar jaoon ya mud jaoon\nSawaal aan khada hai phir se\nGhoomta hai khayal dil mein phir se\nZindagi gol hai zameen ki tarah",
    contentEn: "Then that same turn comes into view -\nLife is round like the earth\nThere are more turns beyond that turn\n\nMany destinations watch the path\nMany desires are searching\nThe moon is perhaps a bit more beautiful\nThe weather is perhaps a bit more colorful\nThere are more comforts beyond that turn\n\nI will definitely turn this time\nI had thought this before too\nI won't stop even if stopped this time\nI had thought this before too\n\nTresses, embraces, relationships, the past\nLeaving everyone behind I will move forward\nYes- I had thought this before too\n\nThen that same turn comes into view\nThat same condition of the heart is back again\nThe tresses have started swaying again\nThe pull of relationships stops me\n\nSome voice pulls me again\nShould I stop, pass by, or turn\nThe question stands before me again\nThe thought spins in the heart again\nLife is round like the earth"
  }
];

const App = () => {
  const [user, setUser] = useState(null);
  
  const [selectedPoemId, setSelectedPoemId] = useState('0');
  
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [darkMode, setDarkMode] = useState(false);
  
  const [languageMode, setLanguageMode] = useState('hi');
  const [favorites, setFavorites] = useState([]);
  const [recordings, setRecordings] = useState({});
  const [ratings, setRatings] = useState({});
  
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [micError, setMicError] = useState(null);
  const [successMsg, setSuccessMsg] = useState(null);
  
  const [downloadFormat, setDownloadFormat] = useState('mp3');
  const [isDownloading, setIsDownloading] = useState(false);

  const [customPoems, setCustomPoems] = useState([]);
  const [deletedOriginals, setDeletedOriginals] = useState([]);
  const [poemOrder, setPoemOrder] = useState([]);

  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [editingPoemId, setEditingPoemId] = useState(null);
  const [poemToDelete, setPoemToDelete] = useState(null);

  const [newPoem, setNewPoem] = useState({
    title: '', titleTrans: '', titleEn: '',
    content: '', contentTrans: '', contentEn: ''
  });
  const [isTranslating, setIsTranslating] = useState(false);
  const [isSuggestingLine, setIsSuggestingLine] = useState(false);
  
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncProgress, setSyncProgress] = useState('');

  const [poemAnalysis, setPoemAnalysis] = useState(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  
  const [poemGlossary, setPoemGlossary] = useState(null);
  const [isFetchingGlossary, setIsFetchingGlossary] = useState(false);
  
  const [isAdmin, setIsAdmin] = useState(false);
  const [adminClickCount, setAdminClickCount] = useState(0);

  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const timerRef = useRef(null);

  useEffect(() => {
    // Ensure Tailwind uses class-based dark mode
    window.tailwind = window.tailwind || {};
    window.tailwind.config = {
      darkMode: 'class'
    };

    if (!document.querySelector('script[src*="tailwindcss"]')) {
      const script = document.createElement('script');
      script.src = "https://cdn.tailwindcss.com";
      document.head.appendChild(script);
    }

    // CHECK FOR SECRET ADMIN LINK
    const params = new URLSearchParams(window.location.search);
    const adminParam = params.get('admin');
    
    if (adminParam === 'true') {
      localStorage.setItem('mera_sach_admin', 'true');
      setIsAdmin(true);
    } else if (adminParam === 'false') {
      localStorage.removeItem('mera_sach_admin');
      setIsAdmin(false);
    } else if (localStorage.getItem('mera_sach_admin') === 'true') {
      setIsAdmin(true);
    }
  }, []);

  // Initialize Firebase Auth
  useEffect(() => {
    if (!auth) return;
    const initAuth = async () => {
      try {
        await signInAnonymously(auth);
      } catch (error) {
        if (error.code === 'auth/admin-restricted-operation' || error.code === 'auth/operation-not-allowed') {
           console.warn("Firebase Anonymous Auth is disabled. The app will work locally.");
        } else {
           console.error('Auth error:', error);
        }
      }
    };
    initAuth();
    const unsubscribe = onAuthStateChanged(auth, setUser);
    return () => unsubscribe();
  }, []);

  // 1. Load recordings from Local DB (IndexedDB)
  useEffect(() => {
    const loadLocal = async () => {
      try {
        const locals = await getAllAudioDB();
        const localRecordings = {};
        for (const [idxStr, data] of Object.entries(locals)) {
          localRecordings[idxStr] = {
            url: data.audioBase64,
            type: data.mimeType && data.mimeType.includes('video') ? 'video' : 'audio',
            label: 'Local'
          };
        }
        setRecordings(prev => ({ ...localRecordings, ...prev }));
      } catch(e) {
        console.error("Local DB load error", e);
      }
    };
    loadLocal();
  }, []);

  // 2. Fetch data from Firebase Firestore
  useEffect(() => {
    if (!db || !appId) return; 

    const activeUid = user ? user.uid : getLocalUid();

    // SYSTEM SETTINGS (for hiding deleted originals & custom ordering)
    const settingsRef = doc(db, 'mera_sach_settings', 'system');
    const unsubSettings = onSnapshot(settingsRef, (docSnap) => {
      if (docSnap.exists()) {
         const data = docSnap.data();
         setDeletedOriginals(data.deletedOriginals || []);
         setPoemOrder(data.poemOrder || []);
      }
    }, (error) => console.error("Firestore settings sub error:", error));

    // AUDIO
    const recordingsRef = collection(db, 'mera_sach_audio');
    const unsubAudio = onSnapshot(recordingsRef, (snapshot) => {
      const newRecordings = {};
      snapshot.docs.forEach(docSnap => {
        const data = docSnap.data();
        const rawId = docSnap.id.replace('poem_', '');
        newRecordings[rawId] = {
          url: data.audioBase64,
          type: data.mimeType && data.mimeType.includes('video') ? 'video' : 'audio',
          label: 'Cloud'
        };
      });
      setRecordings(prev => ({ ...prev, ...newRecordings }));
    }, (error) => console.error("Firestore audio sub error:", error));

    // AUDIO CHUNKS (V2 - Large Files Support)
    const metaRef = collection(db, 'mera_sach_audio_meta');
    const unsubMeta = onSnapshot(metaRef, async (snapshot) => {
      for (const docSnap of snapshot.docs) {
        const poemId = docSnap.id.replace('poem_', '');
        const meta = docSnap.data();
        
        try {
          const chunkPromises = [];
          for (let i = 0; i < meta.numChunks; i++) {
            chunkPromises.push(getDoc(doc(db, 'mera_sach_audio_chunks', `poem_${poemId}_${i}`)));
          }
          const chunkSnaps = await Promise.all(chunkPromises);
          let fullBase64 = "";
          chunkSnaps.forEach(snap => {
            if (snap.exists()) fullBase64 += snap.data().data;
          });
          
          if (fullBase64) {
            setRecordings(prev => ({
              ...prev,
              [poemId]: {
                url: fullBase64,
                type: meta.mimeType.includes('video') ? 'video' : 'audio',
                label: 'Cloud'
              }
            }));
          }
        } catch (e) {
          console.error("Error fetching audio chunks for poem", poemId, e);
        }
      }
    }, (error) => console.error("Firestore meta sub error:", error));

    // RATINGS
    const ratingsRef = collection(db, 'mera_sach_ratings');
    const unsubRatings = onSnapshot(ratingsRef, (snapshot) => {
      const newRatings = {};
      const localRatingsRaw = localStorage.getItem('mera_sach_local_ratings');
      const localRatings = localRatingsRaw ? JSON.parse(localRatingsRaw) : {};

      snapshot.docs.forEach(docSnap => {
        const data = docSnap.data();
        const rawId = docSnap.id.replace('poem_', '');
        
        let totalStars = 0;
        let count = 0;
        let currentUserRating = 0;

        for (const [uid, starVal] of Object.entries(data)) {
          if (typeof starVal === 'number') {
            totalStars += starVal;
            count++;
            if (uid === activeUid) currentUserRating = starVal;
          }
        }
        
        if (!currentUserRating && localRatings[rawId]) {
            currentUserRating = localRatings[rawId];
            totalStars += currentUserRating;
            count++;
        }
        
        newRatings[rawId] = {
          avg: count > 0 ? totalStars / count : 0,
          count: count,
          userRating: currentUserRating
        };
      });

      for (const [idxStr, starVal] of Object.entries(localRatings)) {
        if (!newRatings[idxStr]) {
           newRatings[idxStr] = { avg: starVal, count: 1, userRating: starVal };
        }
      }

      setRatings(newRatings);
    }, (error) => {
      console.error("Firestore rating sub error:", error);
      const localRatingsRaw = localStorage.getItem('mera_sach_local_ratings');
      if (localRatingsRaw) {
          const localRatings = JSON.parse(localRatingsRaw);
          const fallbackRatings = {};
          for (const [idxStr, starVal] of Object.entries(localRatings)) {
              fallbackRatings[idxStr] = { avg: starVal, count: 1, userRating: starVal };
          }
          setRatings(prev => ({ ...fallbackRatings, ...prev }));
      }
    });

    // CUSTOM POEMS
    const poemsRef = collection(db, 'mera_sach_custom_poems');
    const unsubPoems = onSnapshot(poemsRef, (snapshot) => {
      const loaded = [];
      snapshot.docs.forEach(docSnap => {
        loaded.push({ id: docSnap.id, ...docSnap.data() });
      });
      loaded.sort((a, b) => a.createdAt - b.createdAt);
      setCustomPoems(loaded);
    }, (error) => console.error("Firestore custom poems sub error:", error));

    return () => {
      unsubSettings();
      unsubAudio();
      unsubMeta();
      unsubRatings();
      unsubPoems();
    };
  }, [user]);

  // ALL POEMS MERGE (Originals + Custom Uploads + Overrides)
  const allPoems = useMemo(() => {
    // Separate pure new custom poems and those overriding an original poem
    const pureCustom = customPoems.filter(p => p.overridesOriginal === undefined || p.overridesOriginal === null);
    const overrides = customPoems.filter(p => p.overridesOriginal !== undefined && p.overridesOriginal !== null);
    
    // Process original hardcoded poems
    const base = INITIAL_POEMS.map((p, idx) => {
       const stableId = String(idx);
       
       // Hide if marked as deleted globally
       if (deletedOriginals.includes(stableId)) return null;

       // If it has been edited, use the cloud version but keep the stable original ID
       const override = overrides.find(o => o.overridesOriginal === stableId);
       if (override) return { ...override, stableId }; 
       
       return { ...p, stableId };
    }).filter(Boolean); // Remove nulls (deleted ones)

    // Map pure custom poems to use their cloud Document ID as their stableId
    const mappedCustom = pureCustom.map(p => ({ ...p, stableId: p.id }));

    return [...base, ...mappedCustom];
  }, [customPoems, deletedOriginals]);


  // Sync URL safely
  useEffect(() => {
    try {
      if (window.location.protocol === 'blob:' || window.location.origin === 'null') return;
      const params = new URLSearchParams(window.location.search);
      const poemIdStr = params.get('poem');
      if (poemIdStr !== null) {
        setSelectedPoemId(poemIdStr);
      }
    } catch (err) {
      console.warn("Could not read URL params:", err);
    }
  }, []);

  useEffect(() => {
    try {
      if (window.location.protocol === 'blob:' || window.location.origin === 'null') return;
      const url = new URL(window.location);
      url.searchParams.set('poem', selectedPoemId);
      window.history.pushState({}, '', url);
    } catch (err) {
      console.warn("History pushState blocked in this environment.");
    }
  }, [selectedPoemId]);


  // DYNAMIC SORTING Logic: Sorts by custom manual order, then falls back to global star rating.
  const sortedPoems = useMemo(() => {
    const currentOrder = [...poemOrder];
    return [...allPoems].sort((a, b) => {
        let indexA = currentOrder.indexOf(a.stableId);
        let indexB = currentOrder.indexOf(b.stableId);
        
        // If not explicitly ordered yet, append to the bottom
        if (indexA === -1) indexA = Number.MAX_SAFE_INTEGER;
        if (indexB === -1) indexB = Number.MAX_SAFE_INTEGER;

        if (indexA !== indexB) {
            return indexA - indexB;
        }

        // Fallback for ties (newly added poems) - by rating
        const avgA = ratings[a.stableId]?.avg || 0;
        const avgB = ratings[b.stableId]?.avg || 0;
        return avgB - avgA || String(a.stableId).localeCompare(String(b.stableId)); 
    });
  }, [ratings, allPoems, poemOrder]);

  const filteredPoems = useMemo(() => {
    return sortedPoems.filter(p => 
      p.title.toLowerCase().includes(searchTerm.toLowerCase()) || 
      (p.titleEn && p.titleEn.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (p.titleTrans && p.titleTrans.toLowerCase().includes(searchTerm.toLowerCase())) ||
      p.content.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [searchTerm, sortedPoems]);

  // Find the exact rank/position of the actively viewed poem in the newly sorted array
  const currentSortedIndex = useMemo(() => {
    return sortedPoems.findIndex(p => p.stableId === selectedPoemId);
  }, [sortedPoems, selectedPoemId]);

  // --------------------------------------------------------
  // POEM ADD / EDIT / DELETE / MOVE ACTIONS
  // --------------------------------------------------------

  const handleFooterClick = () => {
    setAdminClickCount(prev => prev + 1);
    if (adminClickCount >= 4) { // 5 total clicks required
        setIsAdmin(!isAdmin);
        setAdminClickCount(0);
        if (!isAdmin) {
          localStorage.setItem('mera_sach_admin', 'true');
        } else {
          localStorage.removeItem('mera_sach_admin');
        }
    }
  };

  const movePoemUp = async (stableId) => {
    if (!db) return;
    const idx = sortedPoems.findIndex(p => p.stableId === stableId);
    if (idx <= 0) return; // already at the top

    // Map the current visual order into a flat array of IDs
    const newOrder = sortedPoems.map(p => p.stableId);
    // Swap elements
    [newOrder[idx - 1], newOrder[idx]] = [newOrder[idx], newOrder[idx - 1]];
    
    try {
       await setDoc(doc(db, 'mera_sach_settings', 'system'), { poemOrder: newOrder }, { merge: true });
    } catch(e) { console.error("Move Up Failed", e); }
  };

  const movePoemDown = async (stableId) => {
    if (!db) return;
    const idx = sortedPoems.findIndex(p => p.stableId === stableId);
    if (idx === -1 || idx >= sortedPoems.length - 1) return; // already at the bottom

    const newOrder = sortedPoems.map(p => p.stableId);
    [newOrder[idx], newOrder[idx + 1]] = [newOrder[idx + 1], newOrder[idx]];
    
    try {
       await setDoc(doc(db, 'mera_sach_settings', 'system'), { poemOrder: newOrder }, { merge: true });
    } catch(e) { console.error("Move Down Failed", e); }
  };

  const handleEditClick = (poemToEdit) => {
    setNewPoem({
      title: poemToEdit.title || '', titleTrans: poemToEdit.titleTrans || '', titleEn: poemToEdit.titleEn || '',
      content: poemToEdit.content || '', contentTrans: poemToEdit.contentTrans || '', contentEn: poemToEdit.contentEn || ''
    });
    setEditingPoemId(poemToEdit.stableId);
    setIsAddModalOpen(true);
  };

  const handleSyncLocalAudio = async () => {
    if (!db) return;
    setIsSyncing(true);
    try {
      const localDB = await getAllAudioDB();
      const keys = Object.keys(localDB);
      let count = 0;
      for (const key of keys) {
        count++;
        setSyncProgress(`Syncing ${count}/${keys.length}...`);
        const data = localDB[key];
        await uploadAudioToCloud(db, key, data.audioBase64, data.mimeType);
      }
      setSuccessMsg(`Successfully backed up ${keys.length} recordings to cloud!`);
      setTimeout(() => setSuccessMsg(null), 5000);
    } catch (err) {
      console.error("Sync error:", err);
      setMicError("Failed to sync some recordings. See console for details.");
      setTimeout(() => setMicError(null), 5000);
    }
    setIsSyncing(false);
    setSyncProgress('');
  };

  const handleSaveNewPoem = async () => {
    if (!newPoem.title || !newPoem.content) {
      setMicError("Hindi Title and Content are required.");
      setTimeout(() => setMicError(null), 3000);
      return;
    }
    if (!db) {
      setMicError("Database connection missing. Cannot save poem to cloud.");
      setTimeout(() => setMicError(null), 3000);
      return;
    }
    try {
      if (editingPoemId !== null) {
        // WE ARE EDITING AN EXISTING POEM
        
        // 1. Is it an original hardcoded poem? (ID will be a numeric string '0', '1', etc)
        const isOriginal = INITIAL_POEMS[editingPoemId] !== undefined;

        if (isOriginal) {
            // Find if we already have an override cloud document for this original poem
            const existingOverride = customPoems.find(p => p.overridesOriginal === editingPoemId);
            
            if (existingOverride) {
                await updateDoc(doc(db, 'mera_sach_custom_poems', existingOverride.id), {
                    ...newPoem, updatedAt: Date.now()
                });
            } else {
                // Create a new cloud document linking to the original
                await setDoc(doc(collection(db, 'mera_sach_custom_poems')), {
                    ...newPoem, overridesOriginal: editingPoemId, updatedAt: Date.now(), tags: ["Edited"]
                });
            }
        } else {
            // 2. It is a pure custom uploaded poem
            await updateDoc(doc(db, 'mera_sach_custom_poems', editingPoemId), {
                ...newPoem, updatedAt: Date.now()
            });
        }
        setSuccessMsg("Poem updated successfully!");

      } else {
        // WE ARE ADDING A BRAND NEW POEM
        const newDocRef = doc(collection(db, 'mera_sach_custom_poems'));
        await setDoc(newDocRef, {
          ...newPoem,
          createdAt: Date.now(),
          tags: ["Custom"]
        });
        setSuccessMsg("Poem added successfully!");
      }

      setIsAddModalOpen(false);
      setEditingPoemId(null);
      setNewPoem({title: '', titleTrans: '', titleEn: '', content: '', contentTrans: '', contentEn: ''});
      setTimeout(() => setSuccessMsg(null), 3000);
    } catch (e) {
      console.error(e);
      setMicError("Failed to save poem. Ensure database is in test mode.");
      setTimeout(() => setMicError(null), 3000);
    }
  };

  const confirmDeletePoem = async () => {
    if (!poemToDelete || !db) return;
    
    try {
       const isOriginal = INITIAL_POEMS[poemToDelete] !== undefined;

       if (isOriginal) {
          // If it's an original, we hide it globally using the settings document
          await setDoc(doc(db, 'mera_sach_settings', 'system'), {
             deletedOriginals: arrayUnion(poemToDelete)
          }, { merge: true });
       } else {
          // If it's a custom uploaded poem, physically delete it from the cloud
          await deleteDoc(doc(db, 'mera_sach_custom_poems', poemToDelete));
       }

       // Navigate away from the deleted poem to the first available one
       if (sortedPoems.length > 0) {
         setSelectedPoemId(sortedPoems[0].stableId);
       }
       setSuccessMsg("Poem deleted.");
       setPoemToDelete(null);
       setTimeout(() => setSuccessMsg(null), 3000);

    } catch (e) {
       console.error("Delete failed", e);
       setMicError("Failed to delete. Ensure database permissions are open.");
       setPoemToDelete(null);
       setTimeout(() => setMicError(null), 3000);
    }
  };

  const handlePoemSelect = (stableId) => {
    if (isRecording) stopRecording();
    setSelectedPoemId(stableId);
    setLanguageMode('hi');
    setMicError(null);
    setSuccessMsg(null);
    setPoemAnalysis(null); // Reset AI analysis when switching poems
    setPoemGlossary(null); // Reset Glossary
    if (window.innerWidth < 1024) setIsSidebarOpen(false);
  };

  const autoTranslatePoem = async () => {
    const inputTitle = newPoem.title || newPoem.titleTrans || newPoem.titleEn || "";
    const inputContent = newPoem.content || newPoem.contentTrans || newPoem.contentEn || "";

    if (!inputTitle && !inputContent) {
      setMicError("Please enter a title or content in at least one language first.");
      setTimeout(() => setMicError(null), 3000);
      return;
    }

    setIsTranslating(true);
    try {
      const apiKey = "";
      const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-09-2025:generateContent?key=${apiKey}`;
      
      const systemPrompt = `You are a poetry translator. The user will provide a poem (title and content) in either Hindi (Devanagari script), Roman Hindi (Transliteration), or English.
      Your task is to provide the missing forms so that all three exist: Hindi, Roman Hindi, and English.
      Maintain the poetic flow, emotional depth, and rhythm in the translations.`;

      const payload = {
        contents: [{ parts: [{ text: `Original Input:\nTitle: ${inputTitle}\nContent:\n${inputContent}` }] }],
        systemInstruction: { parts: [{ text: systemPrompt }] },
        generationConfig: { 
          responseMimeType: "application/json",
          responseSchema: {
            type: "OBJECT",
            properties: {
              title: { type: "STRING", description: "Title in Hindi (Devanagari)" },
              titleTrans: { type: "STRING", description: "Title in Roman Hindi (Transliteration)" },
              titleEn: { type: "STRING", description: "Title translated to English" },
              content: { type: "STRING", description: "Content in Hindi (Devanagari)" },
              contentTrans: { type: "STRING", description: "Content in Roman Hindi (Transliteration)" },
              contentEn: { type: "STRING", description: "Content translated to English" }
            }
          }
        }
      };

      const delays = [1000, 2000, 4000, 8000, 16000];
      let data;
      for (let i = 0; i <= 5; i++) {
        try {
          const response = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
          if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
          data = await response.json();
          break;
        } catch (error) {
          if (i === 5) throw error;
          await new Promise(resolve => setTimeout(resolve, delays[i]));
        }
      }

      const textData = data.candidates?.[0]?.content?.parts?.[0]?.text;
      if (textData) {
        const parsed = JSON.parse(textData);
        setNewPoem(prev => ({
          ...prev,
          title: parsed.title || prev.title,
          titleTrans: parsed.titleTrans || prev.titleTrans,
          titleEn: parsed.titleEn || prev.titleEn,
          content: parsed.content || prev.content,
          contentTrans: parsed.contentTrans || prev.contentTrans,
          contentEn: parsed.contentEn || prev.contentEn
        }));
        setSuccessMsg("Translations generated successfully!");
        setTimeout(() => setSuccessMsg(null), 3000);
      }
    } catch (err) {
      console.error(err);
      setMicError("Failed to auto-translate. Please try again.");
      setTimeout(() => setMicError(null), 3000);
    } finally {
      setIsTranslating(false);
    }
  };

  const handleRate = async (starValue) => {
    const activeUid = user ? user.uid : getLocalUid();

    try {
      const localRatings = JSON.parse(localStorage.getItem('mera_sach_local_ratings') || '{}');
      localRatings[selectedPoemId] = starValue;
      localStorage.setItem('mera_sach_local_ratings', JSON.stringify(localRatings));
      
      setRatings(prev => {
        const existing = prev[selectedPoemId] || { avg: 0, count: 0 };
        return {
          ...prev,
          [selectedPoemId]: { 
             ...existing, 
             userRating: starValue,
             avg: existing.count === 0 ? starValue : existing.avg,
             count: existing.count === 0 ? 1 : existing.count
          }
        };
      });
      setSuccessMsg("Rating saved!");
      setTimeout(() => setSuccessMsg(null), 3000);
    } catch(e) {
      console.error("Local storage rating failed", e);
    }

    if (db && appId) {
      try {
        const docRef = doc(db, 'mera_sach_ratings', `poem_${selectedPoemId}`);
        await setDoc(docRef, { [activeUid]: starValue }, { merge: true });
      } catch (error) {
        console.error("Rating cloud sync error:", error);
        setMicError("Saved locally (Cloud blocked. Check Firebase Rules).");
        setTimeout(() => setMicError(null), 4000);
      }
    }
  };

  const analyzePoem = async () => {
    if (poemAnalysis) return; 
    setIsAnalyzing(true);
    setMicError(null);

    try {
      const apiKey = "";
      const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-09-2025:generateContent?key=${apiKey}`;

      const systemPrompt = "You are a deeply empathetic literary critic and poet. Your task is to analyze the given Hindi poem. Provide a beautiful, 2-3 paragraph explanation of its core meaning, emotional depth, and underlying metaphors. Speak directly to the reader in a warm, insightful tone in English. Keep it concise but profound.";
      const userQuery = `Title: ${currentPoem.title}\n\nContent:\n${currentPoem.content}`;

      const payload = {
        contents: [{ parts: [{ text: userQuery }] }],
        systemInstruction: { parts: [{ text: systemPrompt }] }
      };

      const delays = [1000, 2000, 4000, 8000, 16000];
      let data;
      for (let i = 0; i <= 5; i++) {
        try {
          const response = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
          if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
          data = await response.json();
          break;
        } catch (error) {
          if (i === 5) throw error;
          await new Promise(resolve => setTimeout(resolve, delays[i]));
        }
      }

      const textData = data.candidates?.[0]?.content?.parts?.[0]?.text;
      if (textData) {
        setPoemAnalysis(textData);
      }
    } catch (err) {
      console.error(err);
      setMicError("Failed to analyze the poem. Please try again.");
      setTimeout(() => setMicError(null), 3000);
    } finally {
      setIsAnalyzing(false);
    }
  };

  const fetchGlossary = async () => {
    if (poemGlossary) return; 
    setIsFetchingGlossary(true);
    setMicError(null);

    try {
      const apiKey = "";
      const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-09-2025:generateContent?key=${apiKey}`;

      const systemPrompt = `You are a helpful dictionary assistant. Extract 4 to 8 of the most difficult, poetic, or deeply meaningful Urdu/Hindi words from the provided poem. Return the result STRICTLY as a JSON array of objects. Each object must have three keys: "word" (the word in Devanagari script), "roman" (Roman transliteration), and "meaning" (brief English meaning). Example: [{"word": "तस्सव्वुर", "roman": "Tassavvur", "meaning": "Imagination"}]`;
      const userQuery = `Title: ${currentPoem.title}\n\nContent:\n${currentPoem.content}`;

      const payload = {
        contents: [{ parts: [{ text: userQuery }] }],
        systemInstruction: { parts: [{ text: systemPrompt }] },
        generationConfig: { responseMimeType: "application/json" }
      };

      const delays = [1000, 2000, 4000, 8000, 16000];
      let data;
      for (let i = 0; i <= 5; i++) {
        try {
          const response = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
          if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
          data = await response.json();
          break;
        } catch (error) {
          if (i === 5) throw error;
          await new Promise(resolve => setTimeout(resolve, delays[i]));
        }
      }

      const textData = data.candidates?.[0]?.content?.parts?.[0]?.text;
      if (textData) {
        setPoemGlossary(JSON.parse(textData));
      }
    } catch (err) {
      console.error(err);
      setMicError("Failed to load word meanings. Please try again.");
      setTimeout(() => setMicError(null), 3000);
    } finally {
      setIsFetchingGlossary(false);
    }
  };

  const suggestNextLine = async () => {
    if (!newPoem.content) {
      setMicError("Please start writing your poem first before asking for a suggestion.");
      setTimeout(() => setMicError(null), 3000);
      return;
    }
    setIsSuggestingLine(true);
    try {
      const apiKey = "";
      const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-09-2025:generateContent?key=${apiKey}`;
      const prompt = `You are a poetic muse helping a writer. Read what they have written so far in this Hindi poem, and elegantly suggest the next 1-2 lines to continue the thought, rhythm, and emotion. ONLY output the suggested lines in Devanagari script, nothing else.\n\nPoem so far:\n${newPoem.content}`;

      const payload = { contents: [{ parts: [{ text: prompt }] }] };
      const delays = [1000, 2000, 4000, 8000, 16000];
      let data;
      for (let i = 0; i <= 5; i++) {
        try {
          const response = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
          if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
          data = await response.json();
          break;
        } catch (error) {
          if (i === 5) throw error;
          await new Promise(resolve => setTimeout(resolve, delays[i]));
        }
      }

      const textData = data.candidates?.[0]?.content?.parts?.[0]?.text;
      if (textData) {
         setNewPoem(prev => ({ ...prev, content: prev.content + (prev.content.endsWith("\n") ? "" : "\n") + textData.trim() }));
         setSuccessMsg("✨ Next line suggested!");
         setTimeout(() => setSuccessMsg(null), 3000);
      }
    } catch(e) {
      console.error(e);
      setMicError("Failed to get suggestion.");
      setTimeout(() => setMicError(null), 3000);
    } finally {
      setIsSuggestingLine(false);
    }
  };

  const startRecording = async () => {
    setMicError(null);
    setSuccessMsg(null);
    audioChunksRef.current = [];

    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error("Your browser does not support voice recording.");
      }

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      
      const types = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', 'audio/ogg', 'audio/wav'];
      const mimeType = types.find(type => MediaRecorder.isTypeSupported(type)) || '';

      let recorder;
      try {
        recorder = new MediaRecorder(stream, { mimeType, audioBitsPerSecond: 16000 });
      } catch (e) {
        recorder = new MediaRecorder(stream); 
      }
      mediaRecorderRef.current = recorder;
      
      mediaRecorderRef.current.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) {
          audioChunksRef.current.push(e.data);
        }
      };

      mediaRecorderRef.current.onstop = async () => {
        if (audioChunksRef.current.length > 0) {
          const blobType = mediaRecorderRef.current.mimeType;
          const audioBlob = new Blob(audioChunksRef.current, { type: blobType });
          
          try {
            const reader = new FileReader();
            reader.onloadend = async () => {
              const base64data = reader.result;

              setRecordings(prev => ({ 
                ...prev, 
                [selectedPoemId]: { url: base64data, type: blobType.includes('video') ? 'video' : 'audio', label: 'Local' } 
              }));

              try {
                await saveAudioDB(selectedPoemId, base64data, blobType);
              } catch(e) { console.error("Local DB error:", e); }

              if (db && appId) {
                 try {
                     await uploadAudioToCloud(db, selectedPoemId, base64data, blobType);
                     setSuccessMsg("Cloud saved successfully!");
                 } catch (uploadError) {
                     setSuccessMsg("Saved locally! (Cloud unavailable)");
                     console.error("Cloud save error:", uploadError);
                 }
              } else {
                 setSuccessMsg("Saved successfully (Local)!");
              }
              setTimeout(() => setSuccessMsg(null), 3000);
            };
            reader.readAsDataURL(audioBlob);

          } catch (e) {
            setMicError("Failed to process recording.");
          }
        } else {
          setMicError("No audio was captured. Please try recording again.");
        }
        stream.getTracks().forEach(track => track.stop());
      };

      mediaRecorderRef.current.start(100);
      setIsRecording(true);
      setRecordingTime(0);
      timerRef.current = setInterval(() => setRecordingTime(prev => prev + 1), 1000);
    } catch (err) {
      setMicError("Microphone error. Ensure you have granted permission in your browser settings.");
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      clearInterval(timerRef.current);
    }
  };

  const handleDeleteRecording = async () => {
    try {
      await deleteAudioDB(selectedPoemId);
      setRecordings(p => { const n={...p}; delete n[selectedPoemId]; return n; });
      if (db && appId) {
        await deleteDoc(doc(db, 'mera_sach_audio', `poem_${selectedPoemId}`));
        await deleteDoc(doc(db, 'mera_sach_audio_meta', `poem_${selectedPoemId}`));
      } 
    } catch (e) {
      console.error("Failed to delete recording", e);
    }
  };

  const formatTime = (s) => `${Math.floor(s/60)}:${(s%60).toString().padStart(2, '0')}`;

  const handleDownloadAudio = async () => {
    const currentMedia = recordings[selectedPoemId];
    const currentPoem = allPoems.find(p => p.stableId === selectedPoemId) || allPoems[0];
    if (!currentMedia || !currentMedia.url) return;
    
    setIsDownloading(true);
    try {
      // Fetch base64 to a robust Blob safely to avoid browser URL length limits
      const res = await fetch(currentMedia.url);
      const originalBlob = await res.blob();

      // Apply requested format mime type
      let mimeType = 'audio/mpeg';
      if (downloadFormat === 'wav') mimeType = 'audio/wav';
      else if (downloadFormat === 'webm') mimeType = 'audio/webm';

      const downloadBlob = new Blob([originalBlob], { type: mimeType });
      const downloadUrl = URL.createObjectURL(downloadBlob);

      const link = document.createElement('a');
      link.href = downloadUrl;

      // Create a clean filename from the roman or english title
      const safeTitle = (currentPoem?.titleTrans || currentPoem?.titleEn || "poem").replace(/[^a-z0-9]/gi, '_').toLowerCase();
      link.download = `mera_sach_${safeTitle}.${downloadFormat}`;
      
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      // Clean up memory after download
      setTimeout(() => URL.revokeObjectURL(downloadUrl), 100);
    } catch (err) {
      console.error("Download failed:", err);
      setMicError("Failed to download audio. The file might be too large or corrupted.");
      setTimeout(() => setMicError(null), 3000);
    } finally {
      setIsDownloading(false);
    }
  };

  const currentPoem = allPoems.find(p => p.stableId === selectedPoemId) || allPoems[0] || { title: "No Poems Left", content: "All poems deleted.", stableId: 'empty' };
  const currentMedia = recordings[selectedPoemId];
  const currentRating = ratings[selectedPoemId];

  const displayTitle = languageMode === 'en' ? (currentPoem.titleEn || currentPoem.title) : 
                       languageMode === 'ro' ? (currentPoem.titleTrans || currentPoem.title) : 
                       currentPoem.title;
  
  const displayContent = languageMode === 'en' ? (currentPoem.contentEn || currentPoem.content) : 
                         languageMode === 'ro' ? (currentPoem.contentTrans || currentPoem.content) : 
                         currentPoem.content;

  return (
    <div className={`min-h-screen transition-colors duration-500 ${darkMode ? 'dark bg-slate-900 text-slate-100' : 'bg-slate-50 text-slate-900'}`}>

      {/* Header for Mobile */}
      <header className="lg:hidden sticky top-0 z-30 flex items-center justify-between p-4 bg-slate-50/90 dark:bg-slate-900/90 border-b border-slate-200 dark:border-slate-800 backdrop-blur-md">
        <button onClick={() => setIsSidebarOpen(true)} className="flex items-center gap-2 p-2 bg-red-50 dark:bg-red-900/30 text-red-600 rounded-lg font-bold transition-transform active:scale-95">
          <Menu size={20} />
          <span className="text-sm">Poem List</span>
        </button>
        <button onClick={() => setDarkMode(!darkMode)} className="p-2 hover:bg-slate-200 dark:hover:bg-slate-800 rounded-lg">{darkMode ? <Sun size={20} /> : <Moon size={20} />}</button>
      </header>

      {isSidebarOpen && <div className="fixed inset-0 z-40 bg-black/50 lg:hidden" onClick={() => setIsSidebarOpen(false)} />}

      {/* Sidebar Navigation */}
      <aside className={`fixed top-0 left-0 z-50 h-full w-80 transform transition-transform duration-300 lg:translate-x-0 ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'} bg-white dark:bg-slate-950 border-r border-slate-200 dark:border-slate-800 shadow-xl lg:shadow-none`}>
        <div className="flex flex-col h-full">
          <div className="p-6 border-b border-slate-200 dark:border-slate-800">
            <div className="flex items-center justify-between gap-2 mb-6">
              <div className="flex items-center gap-2">
                <BookOpen className="text-red-500" />
                <h1 className="text-2xl font-bold tracking-tight">मेरा सच</h1>
              </div>
              <button className="lg:hidden p-2 text-slate-400" onClick={() => setIsSidebarOpen(false)}><X size={20}/></button>
            </div>
            <div className="relative mb-4">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
              <input type="text" placeholder="खोजें (Search...)" className="w-full pl-10 pr-4 py-2 bg-slate-100 dark:bg-slate-900 rounded-xl text-sm outline-none transition-all focus:ring-1 focus:ring-red-400" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
            </div>
            {isAdmin && (
              <div className="flex flex-col gap-2 mb-2">
                <button onClick={() => { setEditingPoemId(null); setIsAddModalOpen(true); }} className="w-full py-2 bg-slate-800 dark:bg-slate-700 text-white rounded-xl text-sm font-medium hover:bg-slate-700 transition-colors flex justify-center items-center gap-2">
                  <span className="text-lg leading-none mt-[-2px]">+</span> Upload New Poem
                </button>
                <button onClick={handleSyncLocalAudio} disabled={isSyncing} className="w-full py-2 bg-blue-600 text-white rounded-xl text-sm font-medium hover:bg-blue-700 transition-colors flex justify-center items-center gap-2">
                  {isSyncing ? <Loader2 className="animate-spin" size={16} /> : <Cloud size={16} />} 
                  {isSyncing ? syncProgress : "Sync Audio to Cloud"}
                </button>
              </div>
            )}
          </div>

          <div className="flex-1 overflow-y-auto p-4 space-y-1 custom-scrollbar">
            {filteredPoems.map((p) => {
                const idx = p.stableId;
                const absoluteIndex = sortedPoems.findIndex(sp => sp.stableId === idx) + 1;
                return (
                    <button key={idx} onClick={() => handlePoemSelect(idx)} className={`w-full text-left p-4 rounded-xl flex justify-between items-center transition-all ${selectedPoemId === idx ? 'bg-red-50 dark:bg-red-950/30 text-red-600' : 'hover:bg-slate-100 dark:hover:bg-slate-900'}`}>
                        <div className="flex flex-col max-w-[80%]">
                           <span className="font-medium truncate">{absoluteIndex}. {languageMode === 'hi' ? p.title : (p.titleTrans || p.title)}</span>
                           {ratings[idx]?.avg > 0 && (
                             <span className="text-[10px] text-yellow-500 font-bold flex items-center mt-1">
                               <Star size={10} fill="currentColor" className="mr-1"/> {ratings[idx].avg.toFixed(1)}
                             </span>
                           )}
                        </div>
                        {recordings[idx] && <Cloud size={14} className="text-blue-500 shrink-0 ml-2" />}
                    </button>
                );
            })}
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="lg:ml-80 min-h-screen flex flex-col items-center p-4 lg:p-12 transition-all">
        <div className="hidden lg:flex w-full max-w-2xl justify-end mb-6">
          <button onClick={() => setDarkMode(!darkMode)} className="p-2.5 bg-white dark:bg-slate-800 shadow-sm border border-slate-200 dark:border-slate-700 rounded-full hover:scale-110 transition-transform">{darkMode ? <Sun size={20} /> : <Moon size={20} />}</button>
        </div>

        <article className="max-w-3xl w-full min-h-[600px] p-12 lg:px-20 lg:py-24 bg-white dark:bg-slate-800/80 shadow-2xl rounded-[2.5rem] border border-slate-100 dark:border-slate-700 relative flex flex-col group overflow-hidden">
          
          <ArtisticLineBorder darkMode={darkMode} />

          {/* AUTHOR BACKGROUND IMAGE */}
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-0 overflow-hidden rounded-[2.5rem]">
            <img 
              src="99CDC791-1F47-4D2A-916F-A223156A5988.jpeg" 
              alt="Author Background" 
              className="absolute w-full h-full object-cover mix-blend-multiply dark:mix-blend-screen"
              style={{ 
                filter: 'grayscale(100%) contrast(1.2) opacity(0.12)',
                WebkitMaskImage: 'radial-gradient(ellipse at center, rgba(0,0,0,1) 20%, rgba(0,0,0,0) 70%)',
                maskImage: 'radial-gradient(ellipse at center, rgba(0,0,0,1) 20%, rgba(0,0,0,0) 70%)'
              }}
            />
          </div>

          {/* Foreground Content */}
          <div className="relative z-10 w-full h-full flex flex-col">
            
            {/* FLOATING RECORDING BAR */}
            {isRecording && (
                <div className="fixed top-6 left-1/2 transform -translate-x-1/2 z-50 bg-white/90 dark:bg-slate-800/90 backdrop-blur-md px-6 py-3 rounded-full shadow-2xl border border-red-200 dark:border-red-900/30 flex items-center gap-6 animate-in slide-in-from-top-4 duration-300 ring-2 ring-red-500/20">
                    <div className="flex items-center gap-2">
                        <div className="w-2.5 h-2.5 bg-red-500 rounded-full animate-pulse" />
                        <span className="text-red-500 font-bold font-mono tracking-tighter text-lg">{formatTime(recordingTime)}</span>
                    </div>
                    <div className="h-6 w-px bg-slate-200 dark:bg-slate-700" />
                    <button onClick={stopRecording} className="flex items-center gap-2 text-red-600 hover:text-red-700 transition-colors font-bold uppercase text-xs tracking-widest">
                        <Square size={20} fill="currentColor" />
                        STOP
                    </button>
                </div>
            )}

            <div className="w-full flex flex-col items-center mb-10 text-center">
                
                {/* NOTIFICATIONS */}
                {micError && (
                  <div className="w-full mb-6 bg-red-50 dark:bg-red-900/30 p-4 rounded-2xl flex items-center justify-between gap-3 border border-red-200 dark:border-red-800 animate-in fade-in slide-in-from-top-2">
                    <div className="flex items-center gap-3 text-left">
                       <AlertCircle className="text-red-500 shrink-0" size={20} />
                       <p className="text-xs text-red-700 dark:text-red-300 leading-relaxed">{micError}</p>
                    </div>
                    <button onClick={() => setMicError(null)} className="text-red-500 hover:bg-red-100 dark:hover:bg-red-800 p-1 rounded-lg transition-colors"><X size={16} /></button>
                  </div>
                )}

                {successMsg && (
                  <div className="w-full mb-6 bg-green-50 dark:bg-green-900/30 p-4 rounded-2xl flex items-center gap-3 border border-green-200 dark:border-green-800 animate-in fade-in slide-in-from-top-2">
                    <Save className="text-green-500 shrink-0" size={20} />
                    <p className="text-xs text-green-700 dark:text-green-300 font-bold">{successMsg}</p>
                  </div>
                )}

                {/* ADMIN CONTROL BAR */}
                {isAdmin && currentPoem.stableId !== 'empty' && (
                  <div className="w-full flex items-center justify-between px-5 py-2 mb-8 bg-slate-100/80 dark:bg-slate-800/60 backdrop-blur-sm rounded-2xl border border-slate-200 dark:border-slate-700 animate-in fade-in">
                    <span className="text-[10px] font-bold tracking-widest text-slate-400 uppercase hidden sm:block">Admin Mode Active</span>
                    <div className="flex items-center gap-2 mx-auto sm:mx-0">
                      <button onClick={() => movePoemUp(currentPoem.stableId)} disabled={currentSortedIndex <= 0} className="p-1.5 text-slate-500 hover:text-indigo-500 disabled:opacity-30 transition-colors" title="Move Up"><ChevronUp size={18} /></button>
                      <button onClick={() => movePoemDown(currentPoem.stableId)} disabled={currentSortedIndex >= sortedPoems.length - 1} className="p-1.5 text-slate-500 hover:text-indigo-500 disabled:opacity-30 transition-colors" title="Move Down"><ChevronDown size={18} /></button>
                      <div className="w-px h-5 bg-slate-300 dark:bg-slate-600 mx-2" />
                      <button onClick={() => handleEditClick(currentPoem)} className="p-1.5 text-slate-500 hover:text-blue-500 transition-colors" title="Edit Poem"><Edit size={18} /></button>
                      <button onClick={() => setPoemToDelete(currentPoem.stableId)} className="p-1.5 text-slate-500 hover:text-red-500 transition-colors" title="Delete Poem"><Trash2 size={18} /></button>
                    </div>
                  </div>
                )}
                
                <div className="text-xs font-bold text-slate-400 mb-4 tracking-widest">
                  POEM {currentSortedIndex + 1} OF {allPoems.length}
                </div>

                <div className="flex justify-center items-start flex-wrap gap-4 sm:gap-8 mb-8">
                    {/* Favorite */}
                    <button onClick={() => toggleFavorite(selectedPoemId)} className="flex flex-col items-center group gap-1.5" title="Mark as favorite">
                      <div className={`transition-all flex items-center justify-center h-8 ${favorites.includes(selectedPoemId) ? 'text-red-500 scale-110' : 'text-slate-300 group-hover:text-red-400'}`}>
                        <Heart size={22} fill={favorites.includes(selectedPoemId) ? "currentColor" : "none"} />
                      </div>
                      <span className="text-[10px] font-medium text-slate-400 dark:text-slate-500">Favorite</span>
                    </button>
                    
                    {/* Record (Admin) */}
                    {isAdmin && (
                      <button onClick={startRecording} className="flex flex-col items-center group gap-1.5" title="Record Voice">
                        <div className={`transition-all flex items-center justify-center h-8 ${isRecording ? 'text-red-500 scale-125 animate-pulse' : 'text-slate-300 group-hover:text-red-500'}`}>
                          <Mic size={22} />
                        </div>
                        <span className="text-[10px] font-medium text-slate-400 dark:text-slate-500">Record</span>
                      </button>
                    )}

                    {/* Transliterate */}
                    <button onClick={() => setLanguageMode(languageMode === 'ro' ? 'hi' : 'ro')} className="flex flex-col items-center group gap-1.5" title="Transliterate (Roman Hindi)">
                      <div className={`transition-all flex items-center justify-center h-8 ${languageMode === 'ro' ? 'text-red-600 scale-110' : 'text-slate-300 group-hover:text-red-400'}`}>
                        <span className="font-bold text-xl font-serif leading-none">Aa</span>
                      </div>
                      <span className="text-[10px] font-medium text-slate-400 dark:text-slate-500">Roman</span>
                    </button>

                    {/* Translate */}
                    <button onClick={() => setLanguageMode(languageMode === 'en' ? 'hi' : 'en')} className="flex flex-col items-center group gap-1.5" title="Translate to English">
                      <div className={`transition-all flex items-center justify-center h-8 ${languageMode === 'en' ? 'text-red-600 scale-110' : 'text-slate-300 group-hover:text-red-400'}`}>
                        <Languages size={22} />
                      </div>
                      <span className="text-[10px] font-medium text-slate-400 dark:text-slate-500">English</span>
                    </button>

                    {/* Discover Meaning */}
                    <button onClick={analyzePoem} disabled={isAnalyzing} className="flex flex-col items-center group gap-1.5 disabled:opacity-50" title="✨ Discover Meaning">
                      <div className={`transition-all flex items-center justify-center h-8 ${poemAnalysis ? 'text-indigo-600 scale-110' : 'text-slate-300 group-hover:text-indigo-400'}`}>
                        {isAnalyzing ? <Loader2 className="animate-spin" size={22} /> : <Sparkles size={22} />}
                      </div>
                      <span className="text-[10px] font-medium text-slate-400 dark:text-slate-500">Meaning</span>
                    </button>

                    {/* Difficult Words */}
                    <button onClick={fetchGlossary} disabled={isFetchingGlossary} className="flex flex-col items-center group gap-1.5 disabled:opacity-50" title="Difficult Words">
                      <div className={`transition-all flex items-center justify-center h-8 ${poemGlossary ? 'text-amber-600 scale-110' : 'text-slate-300 group-hover:text-amber-400'}`}>
                        {isFetchingGlossary ? <Loader2 className="animate-spin" size={22} /> : <BookText size={22} />}
                      </div>
                      <span className="text-[10px] font-medium text-slate-400 dark:text-slate-500">Glossary</span>
                    </button>
                </div>

                <h2 className={`font-bold mb-4 tracking-tight text-red-600 dark:text-red-400 leading-tight drop-shadow-sm transition-all duration-300 ${languageMode === 'en' ? 'text-2xl lg:text-4xl font-sans italic' : languageMode === 'ro' ? 'text-2xl lg:text-4xl font-sans font-semibold text-red-700 dark:text-red-300' : 'text-3xl lg:text-5xl font-hindi'}`}>
                  {displayTitle}
                </h2>

                {/* 3-STAR RATING SYSTEM UI */}
                {currentPoem.stableId !== 'empty' && (
                  <div className="flex flex-col items-center justify-center gap-1 mb-6">
                    <div className="flex gap-2">
                      {[1, 2, 3].map(star => (
                        <button 
                          key={star} 
                          onClick={() => handleRate(star)}
                          className={`p-1.5 transition-transform hover:scale-110 active:scale-95 ${currentRating?.userRating >= star ? 'text-yellow-500' : 'text-slate-300 dark:text-slate-600'}`}
                          title={`Rate ${star} Star${star > 1 ? 's' : ''}`}
                        >
                          <Star fill={currentRating?.userRating >= star ? "currentColor" : "none"} size={26} />
                        </button>
                      ))}
                    </div>
                    <span className="text-[10px] text-slate-400 font-bold tracking-widest uppercase">
                      {currentRating?.avg ? `${currentRating.avg.toFixed(1)} ★ Average (${currentRating.count} Rating${currentRating.count !== 1 ? 's' : ''})` : 'Unrated - Be the first to rate!'}
                    </span>
                  </div>
                )}

            </div>

            {/* Media Player Box */}
            {currentMedia && !isRecording && (
                <div className="mb-12 p-5 bg-slate-50/80 dark:bg-slate-900/80 backdrop-blur-sm rounded-2xl border border-slate-200 dark:border-slate-700 animate-in fade-in slide-in-from-top-2 shadow-sm relative z-20">
                    <div className="flex flex-col sm:flex-row justify-between items-center gap-3 mb-4">
                        <span className="text-sm font-medium text-slate-600 dark:text-slate-400 italic text-center sm:text-left">
                          Press Play to listen to poem recitation in my voice
                        </span>
                        <div className="flex items-center gap-3">
                          <select 
                            value={downloadFormat}
                            onChange={(e) => setDownloadFormat(e.target.value)}
                            className="text-xs bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 rounded p-1 cursor-pointer outline-none transition-colors hover:border-blue-400 focus:border-blue-500"
                            title="Select download format"
                          >
                            <option value="mp3">MP3</option>
                            <option value="wav">WAV</option>
                            <option value="webm">WEBM</option>
                          </select>
                          <button onClick={handleDownloadAudio} disabled={isDownloading} className="text-slate-400 hover:text-blue-500 transition-colors disabled:opacity-50" title="Download Audio">
                            {isDownloading ? <Loader2 size={16} className="animate-spin" /> : <Download size={16} />}
                          </button>
                          {isAdmin && (
                            <button onClick={handleDeleteRecording} className="text-slate-400 hover:text-red-500 transition-colors" title="Delete Audio">
                              <Trash2 size={16} />
                            </button>
                          )}
                        </div>
                    </div>
                    {currentMedia.type === 'video' ? (
                      <video src={currentMedia.url} controls className="w-full rounded-xl bg-black shadow-lg" />
                    ) : (
                      <audio src={currentMedia.url} controls className="w-full h-10" />
                    )}
                </div>
            )}

            {/* Poem Text Layer */}
            <div className={`poem-content whitespace-pre-wrap leading-[1.8] text-center drop-shadow-sm opacity-100 ${languageMode === 'en' ? 'text-lg lg:text-xl font-sans italic text-slate-700 dark:text-slate-300' : languageMode === 'ro' ? 'text-lg lg:text-xl font-sans text-slate-800 dark:text-slate-200 font-medium' : 'text-xl lg:text-2xl font-hindi text-slate-800 dark:text-slate-100'}`}>
                {displayContent}
            </div>
            
            {/* Poem Analysis Layer */}
            {poemAnalysis && (
              <div className="mt-12 p-6 md:p-8 bg-indigo-50/80 dark:bg-indigo-900/20 border border-indigo-100 dark:border-indigo-800/30 rounded-3xl animate-in fade-in slide-in-from-top-4 text-left shadow-sm relative">
                <button onClick={() => setPoemAnalysis(null)} className="absolute top-5 right-5 text-indigo-400 hover:text-indigo-600 dark:hover:text-indigo-300 transition-colors"><X size={20} /></button>
                <h3 className="text-sm font-bold text-indigo-800 dark:text-indigo-300 mb-4 flex items-center gap-2 uppercase tracking-widest">
                  <Sparkles size={18} /> Heart of the Poem
                </h3>
                <div className="text-sm md:text-base text-slate-700 dark:text-slate-300 leading-relaxed whitespace-pre-wrap font-sans italic">
                  {poemAnalysis}
                </div>
              </div>
            )}

            {/* Poem Glossary Layer */}
            {poemGlossary && poemGlossary.length > 0 && (
              <div className="mt-8 p-6 md:p-8 bg-amber-50/80 dark:bg-amber-900/20 border border-amber-100 dark:border-amber-800/30 rounded-3xl animate-in fade-in slide-in-from-top-4 text-left shadow-sm relative">
                <button onClick={() => setPoemGlossary(null)} className="absolute top-5 right-5 text-amber-400 hover:text-amber-600 dark:hover:text-amber-300 transition-colors"><X size={20} /></button>
                <h3 className="text-sm font-bold text-amber-800 dark:text-amber-300 mb-4 flex items-center gap-2 uppercase tracking-widest">
                  <BookText size={18} /> Difficult Words
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {poemGlossary.map((item, i) => (
                    <div key={i} className="flex flex-col p-3 bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-amber-50 dark:border-slate-700">
                      <div className="flex items-baseline gap-2 mb-1">
                        <span className="text-lg font-bold font-hindi text-slate-800 dark:text-slate-100">{item.word}</span>
                        <span className="text-xs text-slate-400 italic">({item.roman})</span>
                      </div>
                      <span className="text-sm text-slate-600 dark:text-slate-300">{item.meaning}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <footer onClick={handleFooterClick} className="mt-20 pt-8 border-t border-slate-100 dark:border-slate-700 text-center text-slate-400 italic text-sm mt-auto select-none cursor-pointer">
              संदीप ढींगरा - "मेरा सच"
            </footer>
          </div>
        </article>

        {/* Navigation Controls follow the dynamically sorted array! */}
        <div className="mt-12 flex gap-4 relative z-20">
          <button 
            disabled={currentSortedIndex <= 0} 
            onClick={() => setSelectedPoemId(sortedPoems[currentSortedIndex - 1]?.stableId)} 
            className="px-8 py-3 bg-white dark:bg-slate-800 border dark:border-slate-700 rounded-2xl disabled:opacity-30 shadow-sm hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors font-medium"
          >
            Previous
          </button>
          
          <button 
            disabled={currentSortedIndex >= sortedPoems.length - 1} 
            onClick={() => setSelectedPoemId(sortedPoems[currentSortedIndex + 1]?.stableId)} 
            className="px-8 py-3 bg-red-600 text-white rounded-2xl disabled:opacity-30 shadow-lg shadow-red-200 dark:shadow-none hover:bg-red-700 transition-all font-medium"
          >
            Next Poem
          </button>
        </div>
      </main>

      {/* Add / Edit Poem Modal */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-[100] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 sm:p-6">
          <div className="bg-white dark:bg-slate-800 w-full max-w-3xl rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh] animate-in fade-in zoom-in-95 duration-200">
            <div className="flex justify-between items-center p-6 border-b border-slate-100 dark:border-slate-700">
              <h2 className="text-2xl font-bold text-slate-800 dark:text-slate-100">{editingPoemId ? "Edit Poem" : "Upload New Poem"}</h2>
              <button onClick={() => {setIsAddModalOpen(false); setEditingPoemId(null);}} className="text-slate-400 hover:text-red-500 transition-colors"><X size={24} /></button>
            </div>
            
            <div className="p-6 overflow-y-auto custom-scrollbar flex flex-col gap-6">
              
              <div className="bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-100 dark:border-indigo-800/30 rounded-2xl p-5 flex flex-col sm:flex-row items-center justify-between gap-4">
                <div className="text-sm text-indigo-800 dark:text-indigo-300">
                  <span className="font-bold flex items-center gap-2 mb-1"><Sparkles size={16}/> AI Translation & Transliteration</span>
                  Enter your poem in <b>any one language</b> (Hindi, Roman, or English), then let AI fill in the rest!
                </div>
                <button 
                  onClick={autoTranslatePoem} 
                  disabled={isTranslating}
                  className="shrink-0 flex items-center gap-2 px-5 py-2.5 bg-indigo-600 text-white font-bold rounded-xl hover:bg-indigo-700 transition-all disabled:opacity-50 shadow-md shadow-indigo-200 dark:shadow-none"
                >
                  {isTranslating ? <Loader2 className="animate-spin" size={18} /> : <Sparkles size={18} />}
                  {isTranslating ? "Translating..." : "Auto-Fill Now"}
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-500 mb-2 uppercase tracking-wider">Hindi Title *</label>
                  <input type="text" className="w-full p-3 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-red-400 outline-none" placeholder="उदासी" value={newPoem.title} onChange={e => setNewPoem({...newPoem, title: e.target.value})} />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 mb-2 uppercase tracking-wider">Roman Title</label>
                  <input type="text" className="w-full p-3 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-red-400 outline-none" placeholder="Udaasi" value={newPoem.titleTrans} onChange={e => setNewPoem({...newPoem, titleTrans: e.target.value})} />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 mb-2 uppercase tracking-wider">English Title</label>
                  <input type="text" className="w-full p-3 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-red-400 outline-none" placeholder="Sadness" value={newPoem.titleEn} onChange={e => setNewPoem({...newPoem, titleEn: e.target.value})} />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <div className="flex justify-between items-end mb-2">
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider">Hindi Content *</label>
                    <button 
                      onClick={suggestNextLine}
                      disabled={isSuggestingLine}
                      className="text-[10px] font-bold text-indigo-600 dark:text-indigo-400 hover:text-indigo-800 flex items-center gap-1 uppercase tracking-widest disabled:opacity-50"
                    >
                      {isSuggestingLine ? <Loader2 className="animate-spin" size={12} /> : <Sparkles size={12} />}
                      {isSuggestingLine ? "Thinking..." : "Suggest Line"}
                    </button>
                  </div>
                  <textarea rows={6} className="w-full p-3 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-red-400 outline-none resize-none" placeholder="कविता यहाँ लिखें..." value={newPoem.content} onChange={e => setNewPoem({...newPoem, content: e.target.value})} />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 mb-2 uppercase tracking-wider">Roman Content</label>
                  <textarea rows={6} className="w-full p-3 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-red-400 outline-none resize-none" placeholder="Kavita yahan likhein..." value={newPoem.contentTrans} onChange={e => setNewPoem({...newPoem, contentTrans: e.target.value})} />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 mb-2 uppercase tracking-wider">English Content</label>
                  <textarea rows={6} className="w-full p-3 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-red-400 outline-none resize-none" placeholder="Write poem here..." value={newPoem.contentEn} onChange={e => setNewPoem({...newPoem, contentEn: e.target.value})} />
                </div>
              </div>

            </div>
            
            <div className="p-6 border-t border-slate-100 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 flex justify-end gap-3">
              <button onClick={() => {setIsAddModalOpen(false); setEditingPoemId(null);}} className="px-6 py-2 rounded-xl text-slate-600 dark:text-slate-300 font-bold hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors">Cancel</button>
              <button onClick={handleSaveNewPoem} className="px-6 py-2 rounded-xl bg-red-600 text-white font-bold shadow-lg shadow-red-200 dark:shadow-none hover:bg-red-700 transition-colors">{editingPoemId ? "Save Changes" : "Upload Poem"}</button>
            </div>
          </div>
        </div>
      )}

      {/* Confirm Delete Modal */}
      {poemToDelete && (
         <div className="fixed inset-0 z-[110] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-white dark:bg-slate-800 w-full max-w-sm rounded-3xl shadow-2xl p-6 text-center animate-in fade-in zoom-in-95 duration-200">
               <div className="w-16 h-16 bg-red-100 dark:bg-red-900/30 text-red-500 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Trash2 size={32} />
               </div>
               <h3 className="text-xl font-bold text-slate-800 dark:text-slate-100 mb-2">Delete Poem?</h3>
               <p className="text-slate-500 dark:text-slate-400 mb-8">Are you sure you want to delete this poem? This action cannot be completely undone.</p>
               
               <div className="flex gap-3 justify-center">
                 <button onClick={() => setPoemToDelete(null)} className="px-6 py-3 rounded-xl text-slate-600 dark:text-slate-300 font-bold bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors">Cancel</button>
                 <button onClick={confirmDeletePoem} className="px-6 py-3 rounded-xl bg-red-600 text-white font-bold shadow-lg shadow-red-200 dark:shadow-none hover:bg-red-700 transition-colors">Yes, Delete</button>
               </div>
            </div>
         </div>
      )}

      <style dangerouslySetInnerHTML={{ __html: `
        @import url('https://fonts.googleapis.com/css2?family=Noto+Serif+Devanagari:wght@400;700&family=Noto+Sans+Devanagari:wght@400;700&family=Lora:ital,wght@0,400;0,700;1,400&display=swap');
        
        body { 
            font-family: 'Noto Sans Devanagari', sans-serif; 
            overflow-x: hidden;
        }
        
        .font-hindi { 
            font-family: 'Noto Serif Devanagari', serif; 
        }

        .font-sans {
            font-family: 'Lora', serif;
        }

        .custom-scrollbar::-webkit-scrollbar { 
            width: 4px; 
        }
        
        .custom-scrollbar::-webkit-scrollbar-thumb { 
            background: #cbd5e1; 
            border-radius: 10px; 
        }
        
        .dark .custom-scrollbar::-webkit-scrollbar-thumb { 
            background: #334155; 
        }

        .poem-content {
            text-shadow: 0px 0px 40px rgba(255,255,255,0.8);
        }
        
        .dark .poem-content {
            text-shadow: 0px 0px 40px rgba(15,23,42,0.8);
        }

        audio::-webkit-media-controls-panel {
          background-color: transparent;
        }
      `}} />
    </div>
  );
};

export default App;
