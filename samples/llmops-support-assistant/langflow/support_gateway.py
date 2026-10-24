"""Import as an admin custom component; secrets are server-side environment variables."""
import os
import requests
from lfx.custom.custom_component.component import Component
from lfx.io import MessageTextInput, Output
from lfx.schema.message import Message


class SupportGateway(Component):
    display_name = 'Support Assistant (LangGraph)'
    description = 'Run the versioned LangGraph service through its authenticated API.'
    icon = 'Network'
    name = 'SupportGateway'
    inputs = [MessageTextInput(name='input_value', display_name='Customer question', input_types=['Message'])]
    outputs = [Output(display_name='Answer', name='message', method='run_graph')]

    def run_graph(self) -> Message:
        response = requests.post(
            os.environ['SUPPORT_ASSISTANT_URL'].rstrip('/') + '/api/assist',
            headers={'Authorization': 'Bearer ' + os.environ['SUPPORT_ASSISTANT_TOKEN']},
            json={'question': str(self.input_value)}, timeout=90,
        )
        response.raise_for_status()
        result = response.json()
        text = result['answer'] + '\n\nSources: ' + ', '.join(result['sources'])
        text += '\nGraph: ' + ' → '.join(result['steps'])
        self.status = {'category': result['category'], 'release': result['release']}
        return Message(text=text)
