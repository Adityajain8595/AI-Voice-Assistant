import os
from dotenv import load_dotenv
from langchain_core.prompts import ChatPromptTemplate, MessagesPlaceholder
from langchain_core.runnables.history import RunnableWithMessageHistory
from langchain_core.output_parsers import StrOutputParser
from langchain_google_vertexai import VertexAI
from google.cloud import texttospeech
from session_store import get_session_history

load_dotenv()

llm = VertexAI(
    model_name="gemini-2.0-flash",
    project=os.getenv("GCP_PROJECT_ID"),
    location="global",
    temperature=0.2
)

system_prompt = """
You are an intelligent and versatile AI voice assistant. 
Your role is to provide **clear, determined, and impressive answers** across any topic of knowledge, communication, or assistance.

If a question is inappropriate or vague,
respond with: 
**"⚠️ I am here to assist with any questions you may have. Kindly ask appropriate questions."**

Guidelines for answering:
- Always respond with **confidence and precision**, avoiding vague or filler phrases. 
- Deliver responses that feel **concise and polished**. 
- Communicate in a **human-like, natural, and professional tone**. 
- When appropriate, ask if the user would like further assistance or help. 
"""

qa_prompt = ChatPromptTemplate.from_messages([
    ("system", system_prompt),
    MessagesPlaceholder(variable_name="chat_history"),
    ("human", "{input}")
])

llm_chain = qa_prompt | llm | StrOutputParser()

conversational_chain = RunnableWithMessageHistory(
    llm_chain,
    get_session_history,
    input_messages_key="input",
    history_messages_key="chat_history",
)

def text_to_speech(text: str, lang: str = "en", voice: str = "female") -> bytes:
    
    if not text.strip():
        return b""

    client = texttospeech.TextToSpeechClient()

    synthesis_input = texttospeech.SynthesisInput(text=text)

    voice_params = texttospeech.VoiceSelectionParams(
        language_code="en-US",
        ssml_gender=texttospeech.SsmlVoiceGender.FEMALE if voice.lower() == "female" else texttospeech.SsmlVoiceGender.MALE
    )

    audio_config = texttospeech.AudioConfig(audio_encoding=texttospeech.AudioEncoding.MP3)

    response = client.synthesize_speech(
        input=synthesis_input, voice=voice_params, audio_config=audio_config
    )

    return response.audio_content

def process_query(query: str, session_id: str) -> str:
    return conversational_chain.invoke(
        {"input": query},
        config={"configurable": {"session_id": session_id}}
    )
