import type { RiskData } from '@shared/schema';

const OPENROUTER_API_KEY = import.meta.env.VITE_OPENROUTER_API_KEY;
const OPENROUTER_API_URL = 'https://openrouter.ai/api/v1/chat/completions';

interface AnalysisResult {
  severity: 'low' | 'moderate' | 'high' | 'extreme';
  message: string;
  type: 'heat' | 'cold' | 'air_quality';
}

export async function analyzeRiskData(
  riskData: RiskData,
  neighborhoodName: string
): Promise<AnalysisResult> {
  if (!OPENROUTER_API_KEY) {
    throw new Error('OpenRouter API key is not configured');
  }

  const prompt = `Analyze the following climate and environmental data for ${neighborhoodName} and provide a concise risk assessment:
  
Heat Stress Index: ${riskData.hsi}/100
Cold Stress Index: ${riskData.csi}/100
Air Quality Risk Index: ${riskData.aqri}/100
Overall Risk Score: ${riskData.riskScore}/100

Weather Conditions:
- Temperature: ${riskData.raw.weather.temperature}°C
- Humidity: ${riskData.raw.weather.humidity}%
- Wind Speed: ${riskData.raw.weather.windSpeed} km/h
- UV Index: ${riskData.raw.weather.uvIndex}
- Wind Chill: ${riskData.raw.weather.windChill}°C

Air Quality:
- PM2.5: ${riskData.raw.airQuality.pm25 ?? 'N/A'} µg/m³
- PM10: ${riskData.raw.airQuality.pm10 ?? 'N/A'} µg/m³
- NO2: ${riskData.raw.airQuality.no2 ?? 'N/A'} µg/m³

Analyze this data and respond with a JSON object containing:
1. severity: either "low", "moderate", "high", or "extreme"
2. type: either "heat", "cold", or "air_quality" based on the most concerning factor
3. message: a brief, specific warning message about the primary risk factor`;

  try {
    const response = await fetch(OPENROUTER_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
        'HTTP-Referer': window.location.origin,
      },
      body: JSON.stringify({
        model: 'mistralai/mistral-7b-instruct',
        messages: [
          {
            role: 'user',
            content: prompt,
          },
        ],
        temperature: 0.7,
        max_tokens: 200,
      }),
    });

    if (!response.ok) {
      throw new Error('Failed to get AI analysis');
    }

    const data = await response.json();
    const aiResponse = JSON.parse(data.choices[0].message.content);

    return {
      severity: aiResponse.severity,
      type: aiResponse.type,
      message: aiResponse.message,
    };
  } catch (error) {
    console.error('Error analyzing risk data:', error);
    return {
      severity: 'moderate',
      type: 'heat',
      message: 'Unable to perform AI analysis. Please check the raw data metrics.',
    };
  }
}