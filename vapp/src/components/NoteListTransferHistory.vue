<template>
  <div class="box">
    <div style="float: left;">
      <p style="margin-left: 10px; margin-bottom: 20px;">Recent Note Transfer</p>
    </div>
    <table class="table">
      <thead>
        <tr>
          <th>Note</th>
          <th>Type</th>
          <th>Token</th>
          <th>Value</th>
          <th>From</th>
          <th>To</th>
          <th>Change</th>
          <th>Transaction</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="note in transferNotes">
          <td>{{ note.hash | abbreviate }}</td>
          <td>{{ note.type | transferNoteType }}</td>
          <td>{{ note.token | tokenType }}</td>
          <td>{{ note.value | hexToNumberString }}</td>
          <td>{{ note.from | abbreviate }}</td>
          <td>{{ note.to | abbreviate}}</td>
          <td>{{ note.change | hexToNumberString }}</td>
          <td>{{ note.transactionHash | abbreviate }}</td>
        </tr>
      </tbody>
    </table>
  </div>
</template>

<script>
export default {
  props: ['transferNotes'],
};
</script>
